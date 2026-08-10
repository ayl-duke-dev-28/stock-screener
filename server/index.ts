import { createServer, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { fetchStockQuotes, fetchUsMarket, type StockQuote } from './businessQuant'

try { loadEnvFile() } catch { /* Production hosts inject environment variables directly. */ }

const port = Number(process.env.PORT || 8787)
const cacheTtlMs = 15 * 60 * 1000
const distRoot = resolve(process.cwd(), 'dist')
let marketCache: { expiresAt: number; payload: Awaited<ReturnType<typeof fetchUsMarket>> } | null = null
const quoteCache = new Map<string, { expiresAt: number; quote: StockQuote }>()

const json = (response: ServerResponse, status: number, payload: unknown) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': status === 200 ? 'public, max-age=60, stale-while-revalidate=300' : 'no-store',
  })
  response.end(JSON.stringify(payload))
}

async function serveMarket(response: ServerResponse) {
  const apiKey = process.env.BUSINESS_QUANT_API_KEY?.trim()
  if (!apiKey) {
    json(response, 503, {
      error: 'Full-market data is not configured.',
      configurationRequired: true,
    })
    return
  }

  if (marketCache && marketCache.expiresAt > Date.now()) {
    json(response, 200, marketCache.payload)
    return
  }

  try {
    const payload = await fetchUsMarket(apiKey)
    marketCache = { payload, expiresAt: Date.now() + cacheTtlMs }
    json(response, 200, payload)
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Full-market refresh failed',
      detail: error instanceof Error ? error.message.replace(apiKey, '[redacted]') : 'Unknown provider error',
    }))
    json(response, 502, { error: 'The market-data provider is temporarily unavailable.' })
  }
}

async function serveQuotes(tickerQuery: string | null, response: ServerResponse) {
  const apiKey = process.env.BUSINESS_QUANT_API_KEY?.trim()
  if (!apiKey) {
    json(response, 503, { error: 'Market quotes are not configured.', configurationRequired: true })
    return
  }

  const tickers = Array.from(new Set((tickerQuery ?? '').split(',').map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)))
  if (!tickers.length || tickers.length > 50 || tickers.some((ticker) => !/^[A-Z0-9.-]{1,15}$/.test(ticker))) {
    json(response, 400, { error: 'Provide between 1 and 50 valid comma-separated tickers.' })
    return
  }

  const now = Date.now()
  const missing = tickers.filter((ticker) => !quoteCache.has(ticker) || quoteCache.get(ticker)!.expiresAt <= now)
  try {
    if (missing.length) {
      const freshQuotes = await fetchStockQuotes(apiKey, missing)
      freshQuotes.forEach((quote) => quoteCache.set(quote.ticker, { quote, expiresAt: now + cacheTtlMs }))
    }
    const quotes = tickers.flatMap((ticker) => quoteCache.get(ticker)?.quote ?? [])
    json(response, 200, { quotes, source: 'Business Quant' })
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Quote refresh failed',
      detail: error instanceof Error ? error.message.replace(apiKey, '[redacted]') : 'Unknown provider error',
    }))
    json(response, 502, { error: 'The quote provider is temporarily unavailable.' })
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
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const filePath = resolve(distRoot, requested)
  if (!filePath.startsWith(distRoot)) {
    response.writeHead(403).end('Forbidden')
    return
  }
  try {
    const contents = await readFile(filePath)
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream' })
    response.end(contents)
  } catch {
    try {
      const index = await readFile(resolve(distRoot, 'index.html'))
      response.writeHead(200, { 'Content-Type': mimeTypes['.html'] })
      response.end(index)
    } catch {
      response.writeHead(404).end('Build not found. Run npm run build first.')
    }
  }
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  if (request.method === 'GET' && url.pathname === '/api/stocks') {
    await serveMarket(response)
    return
  }
  if (request.method === 'GET' && url.pathname === '/api/quotes') {
    await serveQuotes(url.searchParams.get('tickers'), response)
    return
  }
  if (request.method !== 'GET') {
    json(response, 405, { error: 'Method not allowed' })
    return
  }
  await serveApp(url.pathname, response)
}).listen(port, '0.0.0.0', () => {
  console.log(`Signal server listening on http://localhost:${port}`)
})
