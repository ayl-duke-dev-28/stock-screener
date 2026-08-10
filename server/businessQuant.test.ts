import { describe, expect, it, vi } from 'vitest'
import { fetchUsMarket, mapProviderStock, resolveMetrics } from './businessQuant'

const metadata = [
  { metric_full: 'Market Capitalization', metric_short: 'Market Cap', datatype: 'number' },
  { metric_full: 'Revenue Growth (1y) (TTM)', metric_short: 'Revenue Growth (1y) (TTM)', datatype: '%' },
  { metric_full: 'Net Income Growth (1y) (TTM)', metric_short: 'Net Income Growth (1y) (TTM)', datatype: '%' },
  { metric_full: 'Free Cash Flow Growth (1y) (TTM)', metric_short: 'FCF Growth (1y) (TTM)', datatype: '%' },
  { metric_full: 'Gross Margin (TTM)', metric_short: 'Gross Margin (TTM)', datatype: '%' },
  { metric_full: 'Price to Earnings', metric_short: 'P/E', datatype: 'number' },
  { metric_full: 'Price to Sales', metric_short: 'P/S', datatype: 'number' },
  { metric_full: 'Stock Price', metric_short: 'Price', datatype: 'number' },
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
      price: { requestKey: 'Stock Price', responseKey: 'Price' },
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

  it('rejects missing credentials before making a provider request', async () => {
    const fetcher = vi.fn()
    await expect(fetchUsMarket('  ', fetcher)).rejects.toThrow('BUSINESS_QUANT_API_KEY')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('surfaces a safe provider error for unsuccessful responses', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }))
    await expect(fetchUsMarket('invalid', fetcher)).rejects.toThrow('Business Quant request failed (401)')
  })
})
