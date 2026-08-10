import type { Stock } from '../src/types'

const BASE_URL = 'https://data.businessquant.com'

export interface ProviderMetric {
  metric_full: string
  metric_short?: string
  datatype?: string
  statement?: string
}

export interface MetricMap {
  marketCap?: ResolvedMetric
  revenueGrowth?: ResolvedMetric
  earningsGrowth?: ResolvedMetric
  fcfGrowth?: ResolvedMetric
  grossMargin?: ResolvedMetric
  pe?: ResolvedMetric
  ps?: ResolvedMetric
  price?: ResolvedMetric
  change?: ResolvedMetric
  insiderActivity?: ResolvedMetric
}

export interface ResolvedMetric {
  requestKey: string
  responseKey: string
}

type ProviderRecord = Record<string, unknown>
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

interface ProviderPriceBar {
  close?: number | string | null
}

interface ProviderQuoteSeries {
  metadata?: { ticker?: string }
  data?: ProviderPriceBar[]
}

export interface StockQuote {
  ticker: string
  price: number
  change: number
  sparkline: number[]
}

const findMetric = (metadata: ProviderMetric[], patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const metric = metadata.find((candidate) =>
      pattern.test(candidate.metric_full) || pattern.test(candidate.metric_short ?? ''),
    )
    if (metric) return { requestKey: metric.metric_full, responseKey: metric.metric_short ?? metric.metric_full }
  }
}

export function resolveMetrics(metadata: ProviderMetric[]): MetricMap {
  return {
    marketCap: findMetric(metadata, [/^market capitalization$/i, /^market cap$/i]),
    revenueGrowth: findMetric(metadata, [/^revenue growth \(1y\) \(ttm\)$/i, /revenue growth.*yoy/i, /revenue.*growth/i]),
    earningsGrowth: findMetric(metadata, [/^net income growth \(1y\) \(ttm\)$/i, /net income growth.*yoy/i, /eps growth.*yoy/i, /earnings growth/i]),
    fcfGrowth: findMetric(metadata, [/^free cash flow growth \(1y\) \(ttm\)$/i, /free cash flow growth.*yoy/i, /fcf growth/i]),
    grossMargin: findMetric(metadata, [/^gross margin \(ttm\)$/i, /gross profit margin.*yr/i, /^gross margin/i]),
    pe: findMetric(metadata, [/^price to earnings$/i, /^p\/e ratio$/i, /^price.to.earnings/i]),
    ps: findMetric(metadata, [/^price to sales$/i, /^p\/s ratio$/i, /^price.to.sales/i]),
    price: findMetric(metadata, [/^price$/i, /^stock price$/i, /^current price$/i, /^share price$/i]),
    change: findMetric(metadata, [/price change.*%/i, /1d.*change/i]),
    insiderActivity: findMetric(metadata, [/net insider.*(buy|purchase)/i, /insider.*activity/i]),
  }
}

const numeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const parsed = Number(value.replace(/[$,%×,]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

const getMetric = (record: ProviderRecord, metric: ResolvedMetric | undefined) =>
  metric ? numeric(record[metric.responseKey] ?? record[metric.requestKey]) : null

export function mapProviderStock(record: ProviderRecord, metrics: MetricMap): Stock {
  const ticker = String(record.ticker ?? record.symbol ?? '').trim().toUpperCase()
  const price = getMetric(record, metrics.price)
  const change = getMetric(record, metrics.change)
  const rawMarketCap = getMetric(record, metrics.marketCap)
  const sector = String(record.sector ?? 'Unclassified')
  return {
    ticker,
    name: String(record.name ?? record.name_short ?? ticker),
    sector,
    price,
    change,
    marketCap: rawMarketCap === null ? null : rawMarketCap / 1_000_000_000,
    revenueGrowth: getMetric(record, metrics.revenueGrowth),
    earningsGrowth: getMetric(record, metrics.earningsGrowth),
    fcfGrowth: getMetric(record, metrics.fcfGrowth),
    grossMargin: getMetric(record, metrics.grossMargin),
    pe: getMetric(record, metrics.pe),
    ps: getMetric(record, metrics.ps),
    insiderActivity: getMetric(record, metrics.insiderActivity),
    sparkline: [],
    thesis: `${sector} company ranked against the active fundamental criteria.`,
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Business Quant request failed (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ''}`)
  }
  return response.json() as Promise<T>
}

const samplePrices = (values: number[], sampleSize = 10) => {
  if (values.length <= sampleSize) return values
  return Array.from({ length: sampleSize }, (_, index) =>
    values[Math.round((index / (sampleSize - 1)) * (values.length - 1))],
  )
}

export async function fetchStockQuotes(apiKey: string, tickers: string[], fetcher: Fetcher = fetch) {
  if (!apiKey.trim()) throw new Error('BUSINESS_QUANT_API_KEY is not configured')
  const uniqueTickers = Array.from(new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)))
  if (!uniqueTickers.length) return []
  if (uniqueTickers.length > 50) throw new Error('A maximum of 50 quote tickers can be requested at once')

  const url = new URL('/quotes', BASE_URL)
  url.searchParams.set('ticker', uniqueTickers.join(','))
  url.searchParams.set('mode', 'daily')
  url.searchParams.set('period', '1y')
  url.searchParams.set('limit', '260')
  url.searchParams.set('api_key', apiKey)
  const payload = await readJson<Record<string, ProviderQuoteSeries> | ProviderQuoteSeries>(await fetcher(url))
  const candidateSingle = payload as ProviderQuoteSeries
  const singleTickerPayload = Array.isArray(candidateSingle.data) ? candidateSingle : undefined

  return uniqueTickers.flatMap((ticker): StockQuote[] => {
    const series = singleTickerPayload && uniqueTickers.length === 1
      ? singleTickerPayload
      : (payload as Record<string, ProviderQuoteSeries>)[ticker]
    const newestFirst = (series?.data ?? [])
      .map((bar) => numeric(bar.close))
      .filter((value): value is number => value !== null)
    if (!newestFirst.length) return []
    const latest = newestFirst[0]
    const previous = newestFirst[1] ?? latest
    const chronological = [...newestFirst].reverse()
    return [{
      ticker,
      price: latest,
      change: previous ? ((latest - previous) / previous) * 100 : 0,
      sparkline: samplePrices(chronological),
    }]
  })
}

export async function fetchUsMarket(apiKey: string, fetcher: Fetcher = fetch, pageSize = 1000) {
  if (!apiKey.trim()) throw new Error('BUSINESS_QUANT_API_KEY is not configured')

  const metadataUrl = new URL('/metadata', BASE_URL)
  metadataUrl.searchParams.set('table', 'screener')
  metadataUrl.searchParams.set('api_key', apiKey)
  const metadata = await readJson<ProviderMetric[]>(await fetcher(metadataUrl))
  const metrics = resolveMetrics(metadata)
  const preferredColumns = Array.from(new Set(Object.values(metrics).flatMap((metric) => metric ? [metric.requestKey] : [])))

  const fetchPage = async (page: number) => {
    const url = new URL('/screener', BASE_URL)
    url.searchParams.set('page', String(page))
    url.searchParams.set('limit', String(pageSize))
    url.searchParams.set('api_key', apiKey)
    return readJson<{ metadata: { total_records: number; total_pages: number }; data: ProviderRecord[] }>(await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conditions: '"Market Capitalization" > 0',
        preferred_columns: preferredColumns,
      }),
    }))
  }

  const firstPage = await fetchPage(1)
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, firstPage.metadata.total_pages - 1) }, (_, index) => fetchPage(index + 2)),
  )
  const records = [firstPage, ...remainingPages].flatMap((page) => page.data)
  return {
    stocks: records.map((record) => mapProviderStock(record, metrics)).filter((stock) => stock.ticker),
    total: firstPage.metadata.total_records,
    source: 'Business Quant',
    updatedAt: new Date().toISOString(),
  }
}
