import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join, resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { fetchStockQuotes, fetchUsMarket, readMarketSnapshot, writeMarketSnapshot, type QuoteRange } from './businessQuant'
import { MarketDataCoordinator } from './marketData'
import { compactQuotes, encodeJson, resolvePublicFile, responseHeaders } from './http'

try { loadEnvFile() } catch { /* Production hosts inject environment variables directly. */ }

const port = Number(process.env.PORT || 8787)
const cacheTtlMs = 15 * 60 * 1000
const distRoot = resolve(process.cwd(), 'dist')
const marketSnapshotPath = join(tmpdir(), 'signal-stock-screener', basename(process.cwd()), 'market.json')
let marketSnapshotLoaded: Promise<void> | null = null
const quoteRanges = new Set<QuoteRange>(['1d', '1m', '6m', '1y', '5y'])
const marketData = new MarketDataCoordinator({
  cacheTtlMs,
  fetchMarket: (apiKey) => fetchUsMarket(apiKey),
  fetchQuotes: (apiKey, tickers, range) => fetchStockQuotes(apiKey, tickers, fetch, { range }),
  onMarketRefresh: (payload) => writeMarketSnapshot(marketSnapshotPath, payload).catch((error) => console.error(JSON.stringify({
    level: 'warn', message: 'Market snapshot persistence failed', detail: error instanceof Error ? error.message : 'Unknown file error',
  }))),
})

const json = (request: IncomingMessage, response: ServerResponse, status: number, payload: unknown) => {
  const encoded = encodeJson(payload, request.headers['accept-encoding'])
  response.writeHead(status, {
    ...responseHeaders(status === 200 ? 'api' : 'error'),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(encoded.body.byteLength),
    'Vary': 'Accept-Encoding',
    ...(encoded.encoding ? { 'Content-Encoding': encoded.encoding } : {}),
  })
  response.end(encoded.body)
}

async function serveMarket(request: IncomingMessage, response: ServerResponse) {
  marketSnapshotLoaded ??= readMarketSnapshot(marketSnapshotPath).then((payload) => {
    if (payload) marketData.seedMarket(payload)
  })
  await marketSnapshotLoaded

  const apiKey = process.env.BUSINESS_QUANT_API_KEY?.trim()
  if (!apiKey) {
    const cached = marketData.getCachedMarket()
    if (cached) {
      json(request, response, 200, { ...cached, source: `${cached.source} (cached)`, stale: true })
      return
    }
    json(request, response, 503, {
      error: 'Full-market data is not configured.',
      configurationRequired: true,
    })
    return
  }

  try {
    const result = await marketData.getMarket(apiKey)
    json(request, response, 200, result.stale
      ? { ...result.payload, source: `${result.payload.source} (cached)`, stale: true }
      : result.payload)
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Full-market refresh failed',
      detail: error instanceof Error ? error.message.replace(apiKey, '[redacted]') : 'Unknown provider error',
    }))
    json(request, response, 502, { error: 'The market-data provider is temporarily unavailable. Retry in a few minutes.' })
  }
}

async function serveQuotes(request: IncomingMessage, tickerQuery: string | null, rangeQuery: string | null, detailQuery: string | null, response: ServerResponse) {
  const apiKey = process.env.BUSINESS_QUANT_API_KEY?.trim()
  if (!apiKey) {
    json(request, response, 503, { error: 'Market quotes are not configured.', configurationRequired: true })
    return
  }

  const tickers = Array.from(new Set((tickerQuery ?? '').split(',').map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)))
  if (!tickers.length || tickers.length > 50 || tickers.some((ticker) => !/^[A-Z0-9.-]{1,15}$/.test(ticker))) {
    json(request, response, 400, { error: 'Provide between 1 and 50 valid comma-separated tickers.' })
    return
  }

  const range = (rangeQuery ?? '1y') as QuoteRange
  if (!quoteRanges.has(range)) {
    json(request, response, 400, { error: 'Range must be one of 1d, 1m, 6m, 1y, or 5y.' })
    return
  }

  try {
    const quotes = await marketData.getQuotes(apiKey, tickers, range)
    json(request, response, 200, { quotes: detailQuery === 'summary' ? compactQuotes(quotes) : quotes, source: 'Business Quant', range })
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Quote refresh failed',
      detail: error instanceof Error ? error.message.replace(apiKey, '[redacted]') : 'Unknown provider error',
    }))
    json(request, response, 502, { error: 'The quote provider is temporarily unavailable. Retry shortly.' })
  }
}

const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

async function serveApp(pathname: string, response: ServerResponse) {
  const filePath = resolvePublicFile(distRoot, pathname)
  if (!filePath) {
    response.writeHead(403, responseHeaders('error')).end('Forbidden')
    return
  }
  try {
    const contents = await readFile(filePath)
    response.writeHead(200, { ...responseHeaders(filePath.endsWith('index.html') ? 'html' : 'asset'), 'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream' })
    response.end(contents)
  } catch {
    try {
      const index = await readFile(resolve(distRoot, 'index.html'))
      response.writeHead(200, { ...responseHeaders('html'), 'Content-Type': mimeTypes['.html'] })
      response.end(index)
    } catch {
      response.writeHead(404, responseHeaders('error')).end('Build not found. Run npm run build first.')
    }
  }
}

const server = createServer(async (request, response) => {
  const startedAt = performance.now()
  const url = new URL(request.url ?? '/', 'http://localhost')
  response.once('finish', () => console.log(JSON.stringify({
    level: 'info', method: request.method, path: url.pathname, status: response.statusCode,
    durationMs: Math.round(performance.now() - startedAt),
  })))
  try {
    if (request.method === 'GET' && url.pathname === '/api/stocks') {
      await serveMarket(request, response)
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/quotes') {
      await serveQuotes(request, url.searchParams.get('tickers'), url.searchParams.get('range'), url.searchParams.get('detail'), response)
      return
    }
    if (request.method !== 'GET') {
      json(request, response, 405, { error: 'Method not allowed' })
      return
    }
    await serveApp(url.pathname, response)
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: 'Unhandled request failure', detail: error instanceof Error ? error.message : 'Unknown error' }))
    if (!response.headersSent) json(request, response, 500, { error: 'The server could not complete this request.' })
    else response.destroy()
  }
})

server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'))
server.listen(port, '0.0.0.0', () => {
  console.log(`Signal server listening on http://localhost:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => process.exit(0)))
}
