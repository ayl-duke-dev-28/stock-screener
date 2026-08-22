import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchStockQuotes, fetchUsMarket, mapProviderStock, readMarketSnapshot, resolveMetrics, writeMarketSnapshot } from './businessQuant'

const metadata = [
  { metric_full: 'Market Capitalization', metric_short: 'Market Cap', datatype: 'number' },
  { metric_full: 'Revenue Growth (1y) (TTM)', metric_short: 'Revenue Growth (1y) (TTM)', datatype: '%' },
  { metric_full: 'Net Income Growth (1y) (TTM)', metric_short: 'Net Income Growth (1y) (TTM)', datatype: '%' },
  { metric_full: 'Free Cash Flow Growth (1y) (TTM)', metric_short: 'FCF Growth (1y) (TTM)', datatype: '%' },
  { metric_full: 'Gross Margin (TTM)', metric_short: 'Gross Margin (TTM)', datatype: '%' },
  { metric_full: 'Price to Earnings', metric_short: 'P/E', datatype: 'number' },
  { metric_full: 'Price to Sales', metric_short: 'P/S', datatype: 'number' },
  { metric_full: 'Price', metric_short: 'Price', datatype: 'number' },
]

describe('Business Quant market adapter', () => {
  it('resolves provider metric names from metadata instead of hard-coding the schema', () => {
    expect(resolveMetrics(metadata)).toEqual(expect.objectContaining({
      marketCap: { requestKey: 'Market Capitalization', responseKey: 'Market Cap' },
      revenueGrowth: { requestKey: 'Revenue Growth (1y) (TTM)', responseKey: 'Revenue Growth (1y) (TTM)' },
      earningsGrowth: { requestKey: 'Net Income Growth (1y) (TTM)', responseKey: 'Net Income Growth (1y) (TTM)' },
      fcfGrowth: { requestKey: 'Free Cash Flow Growth (1y) (TTM)', responseKey: 'FCF Growth (1y) (TTM)' },
      grossMargin: { requestKey: 'Gross Margin (TTM)', responseKey: 'Gross Margin (TTM)' },
      pe: { requestKey: 'Price to Earnings', responseKey: 'P/E' },
      ps: { requestKey: 'Price to Sales', responseKey: 'P/S' },
      price: { requestKey: 'Price', responseKey: 'Price' },
    }))
  })

  it('prefers TTM metrics even when broader annual matches appear first in provider metadata', () => {
    const annualFirstMetadata = [
      { metric_full: 'Revenue Growth (1y) (Annual)', metric_short: 'Revenue Growth (1y) (Yr)' },
      { metric_full: 'Free Cash Flow Growth (1y) (Annual)', metric_short: 'FCF Growth (1y) (Yr)' },
      { metric_full: 'Gross Margin (Annual)', metric_short: 'Gross Margin (Yr)' },
      ...metadata,
    ]

    expect(resolveMetrics(annualFirstMetadata)).toEqual(expect.objectContaining({
      revenueGrowth: { requestKey: 'Revenue Growth (1y) (TTM)', responseKey: 'Revenue Growth (1y) (TTM)' },
      fcfGrowth: { requestKey: 'Free Cash Flow Growth (1y) (TTM)', responseKey: 'FCF Growth (1y) (TTM)' },
      grossMargin: { requestKey: 'Gross Margin (TTM)', responseKey: 'Gross Margin (TTM)' },
    }))
  })

  it('maps provider percentages and dollar values into the app stock model', () => {
    const metrics = resolveMetrics(metadata)
    const stock = mapProviderStock({
      ticker: 'TEST', name: 'Test Company', sector: 'Technology',
      'Market Cap': 25_000_000_000, 'Revenue Growth (1y) (TTM)': '18.4%',
      'Net Income Growth (1y) (TTM)': '22.1%', 'FCF Growth (1y) (TTM)': '-3.2%',
      'Gross Margin (TTM)': '64.5%', 'P/E': 27.3, 'P/S': 6.4,
      'Price': 105.2,
    }, metrics)

    expect(stock).toEqual(expect.objectContaining({
      ticker: 'TEST', marketCap: 25, revenueGrowth: 18.4, earningsGrowth: 22.1,
      fcfGrowth: -3.2, grossMargin: 64.5, pe: 27.3, ps: 6.4, price: 105.2,
    }))
  })

  it('represents unavailable provider values as missing instead of fabricated extremes', () => {
    const stock = mapProviderStock({
      ticker: 'MISS', name: 'Missing Metrics Inc.', sector: 'Technology',
      'Market Cap': 1_000_000_000, Price: 10,
    }, resolveMetrics(metadata))

    expect(stock).toEqual(expect.objectContaining({
      revenueGrowth: null,
      earningsGrowth: null,
      fcfGrowth: null,
      grossMargin: null,
      pe: null,
      ps: null,
      change: null,
      insiderActivity: null,
    }))
  })

  it('treats blank and formatting-only provider metrics as missing instead of zero', () => {
    const stock = mapProviderStock({
      ticker: 'BLANK',
      'Market Cap': ' ',
      'Revenue Growth (1y) (TTM)': '%',
      'Net Income Growth (1y) (TTM)': '$,',
    }, resolveMetrics(metadata))

    expect(stock).toEqual(expect.objectContaining({
      marketCap: null,
      revenueGrowth: null,
      earningsGrowth: null,
    }))
  })

  it('rejects impossible provider values instead of ranking or displaying them', () => {
    const stock = mapProviderStock({
      ticker: 'BAD',
      Price: -4,
      'Market Cap': -1_000_000,
      'Gross Margin (TTM)': '362229443.8%',
      'Revenue Growth (1y) (TTM)': '28925.7%',
    }, resolveMetrics(metadata))

    expect(stock).toEqual(expect.objectContaining({
      price: null,
      marketCap: null,
      grossMargin: null,
      revenueGrowth: 28925.7,
    }))
  })

  it('fetches every page of the full US equity universe and returns one combined dataset', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(metadata)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ metadata: { total_records: 2, total_pages: 2 }, data: [{ ticker: 'AAA', name: 'A', sector: 'Technology', 'Market Capitalization': 1_000_000_000 }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ metadata: { total_records: 2, total_pages: 2 }, data: [{ ticker: 'BBB', name: 'B', sector: 'Healthcare', 'Market Capitalization': 2_000_000_000 }] })))

    const result = await fetchUsMarket('secret-key', fetcher, 1)

    expect(result.stocks.map((stock) => stock.ticker)).toEqual(['AAA', 'BBB'])
    expect(result.total).toBe(2)
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(String(fetcher.mock.calls[1][0])).toContain('page=1')
    expect(String(fetcher.mock.calls[2][0])).toContain('page=2')
  })

  it('requests up to 10,000 stocks by default to conserve the daily API allowance', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(metadata)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ metadata: { total_records: 1, total_pages: 1 }, data: [{ ticker: 'AAA' }] })))

    await fetchUsMarket('secret-key', fetcher)

    expect(String(fetcher.mock.calls[1][0])).toContain('limit=10000')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('persists and restores the last known full-market snapshot', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'signal-market-test-'))
    const snapshotPath = join(directory, 'market.json')
    const payload = { stocks: [mapProviderStock({ ticker: 'AAA', Price: 42 }, resolveMetrics(metadata))], total: 1, source: 'Business Quant', updatedAt: '2026-08-10T12:00:00.000Z' }

    try {
      await writeMarketSnapshot(snapshotPath, payload)
      await expect(readMarketSnapshot(snapshotPath)).resolves.toEqual(payload)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects missing credentials before making a provider request', async () => {
    const fetcher = vi.fn()
    await expect(fetchUsMarket('  ', fetcher)).rejects.toThrow('BUSINESS_QUANT_API_KEY')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('surfaces a safe provider error for unsuccessful responses', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }))
    await expect(fetchUsMarket('invalid', fetcher)).rejects.toThrow('Business Quant request failed (401)')
  })

  it('maps current prices, daily changes, and sampled one-year trends', async () => {
    const closes = Array.from({ length: 20 }, (_, index) => 100 + index).reverse()
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      AAPL: { data: closes.map((close) => ({ close })) },
      EMPTY: { data: [] },
    })))

    const quotes = await fetchStockQuotes('secret-key', ['aapl', 'AAPL', 'empty'], fetcher)

    expect(quotes).toHaveLength(1)
    expect(quotes[0]).toEqual(expect.objectContaining({ ticker: 'AAPL', price: 119 }))
    expect(quotes[0].change).toBeCloseTo(((119 - 118) / 118) * 100)
    expect(quotes[0].sparkline).toHaveLength(10)
    expect(quotes[0].sparkline[0]).toBe(100)
    expect(quotes[0].sparkline.at(-1)).toBe(119)
    expect(String(fetcher.mock.calls[0][0])).toContain('ticker=AAPL%2CEMPTY')
    expect(String(fetcher.mock.calls[0][0])).toContain('period=1y')
    expect(fetcher.mock.calls[0][1]).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('caps quote batches to protect the provider and API allowance', async () => {
    const tickers = Array.from({ length: 51 }, (_, index) => `T${index}`)
    await expect(fetchStockQuotes('secret-key', tickers, vi.fn())).rejects.toThrow('maximum of 50')
  })

  it('accepts the provider single-ticker response without a ticker wrapper', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      metadata: { ticker: 'AAPL' },
      data: [{ close: 205 }, { close: 200 }],
    })))

    await expect(fetchStockQuotes('secret-key', ['AAPL'], fetcher)).resolves.toEqual([
      expect.objectContaining({ ticker: 'AAPL', price: 205, sparkline: [200, 205] }),
    ])
  })

  it('requests intraday bars for 1D charts and returns dated price points', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      metadata: { ticker: 'AAPL' },
      data: [
        { date: '2026-08-07 16:00:00', close: 105 },
        { date: '2026-08-07 09:30:00', close: 100 },
      ],
    })))

    const quotes = await fetchStockQuotes('secret-key', ['AAPL'], fetcher, { range: '1d' })

    expect(String(fetcher.mock.calls[0][0])).toContain('mode=minute-bars')
    expect(String(fetcher.mock.calls[0][0])).toContain('period=1d')
    expect(quotes[0].history).toEqual([
      { date: '2026-08-07 09:30:00', price: 100 },
      { date: '2026-08-07 16:00:00', price: 105 },
    ])
  })

  it('requests the full selected daily chart horizon', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      metadata: { ticker: 'AAPL' }, data: [{ date: '2026-08-07 16:00:00', close: 105 }],
    })))

    await fetchStockQuotes('secret-key', ['AAPL'], fetcher, { range: '5y' })

    expect(String(fetcher.mock.calls[0][0])).toContain('mode=daily')
    expect(String(fetcher.mock.calls[0][0])).toContain('period=5y')
    expect(String(fetcher.mock.calls[0][0])).toContain('limit=1500')
    expect(fetcher.mock.calls[0][1]).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })
})
