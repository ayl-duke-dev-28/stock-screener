import type { Stock } from '../src/types'

const BASE_URL = 'https://data.businessquant.com'

export interface ProviderMetric {
  metric_full: string
  metric_short?: string
  datatype?: string
  statement?: string
}

export interface MetricMap {
  marketCap?: string
  revenueGrowth?: string
  earningsGrowth?: string
  fcfGrowth?: string
  grossMargin?: string
  pe?: string
  ps?: string
  price?: string
  change?: string
  insiderActivity?: string
}

type ProviderRecord = Record<string, unknown>
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

const findMetric = (metadata: ProviderMetric[], patterns: RegExp[]) =>
  metadata.find((metric) => patterns.some((pattern) => pattern.test(metric.metric_full) || pattern.test(metric.metric_short ?? '')))?.metric_full

export function resolveMetrics(metadata: ProviderMetric[]): MetricMap {
  return {
    marketCap: findMetric(metadata, [/^market capitalization$/i, /^market cap$/i]),
    revenueGrowth: findMetric(metadata, [/revenue growth.*yoy/i, /revenue.*growth/i]),
    earningsGrowth: findMetric(metadata, [/net income growth.*yoy/i, /eps growth.*yoy/i, /earnings growth/i]),
    fcfGrowth: findMetric(metadata, [/free cash flow growth.*yoy/i, /fcf growth/i]),
    grossMargin: findMetric(metadata, [/gross profit margin.*yr/i, /^gross margin/i]),
    pe: findMetric(metadata, [/^p\/e ratio$/i, /^price.to.earnings/i]),
    ps: findMetric(metadata, [/^p\/s ratio$/i, /^price.to.sales/i]),
    price: findMetric(metadata, [/^stock price$/i, /^current price$/i, /^share price$/i]),
    change: findMetric(metadata, [/price change.*%/i, /1d.*change/i]),
    insiderActivity: findMetric(metadata, [/net insider.*(buy|purchase)/i, /insider.*activity/i]),
  }
}

const numeric = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return fallback
  const parsed = Number(value.replace(/[$,%×,]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : fallback
}

const getMetric = (record: ProviderRecord, key: string | undefined, fallback: number) =>
  key ? numeric(record[key], fallback) : fallback

export function mapProviderStock(record: ProviderRecord, metrics: MetricMap): Stock {
  const ticker = String(record.ticker ?? record.symbol ?? '').trim().toUpperCase()
  const price = getMetric(record, metrics.price, 0)
  const change = getMetric(record, metrics.change, 0)
  const rawMarketCap = getMetric(record, metrics.marketCap, 0)
  const sector = String(record.sector ?? 'Unclassified')
  return {
    ticker,
    name: String(record.name ?? record.name_short ?? ticker),
    sector,
    price,
    change,
    marketCap: rawMarketCap / 1_000_000_000,
    revenueGrowth: getMetric(record, metrics.revenueGrowth, -999),
    earningsGrowth: getMetric(record, metrics.earningsGrowth, -999),
    fcfGrowth: getMetric(record, metrics.fcfGrowth, -999),
    grossMargin: getMetric(record, metrics.grossMargin, -999),
    pe: getMetric(record, metrics.pe, 999),
    ps: getMetric(record, metrics.ps, 999),
    insiderActivity: getMetric(record, metrics.insiderActivity, 0),
    sparkline: Array.from({ length: 10 }, (_, index) => price > 0 ? price * (1 - change / 100 + (change / 100) * (index / 9)) : 0),
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

export async function fetchUsMarket(apiKey: string, fetcher: Fetcher = fetch, pageSize = 1000) {
  if (!apiKey.trim()) throw new Error('BUSINESS_QUANT_API_KEY is not configured')

  const metadataUrl = new URL('/metadata', BASE_URL)
  metadataUrl.searchParams.set('table', 'screener')
  metadataUrl.searchParams.set('api_key', apiKey)
  const metadata = await readJson<ProviderMetric[]>(await fetcher(metadataUrl))
  const metrics = resolveMetrics(metadata)
  const preferredColumns = Array.from(new Set(Object.values(metrics).filter(Boolean)))

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
