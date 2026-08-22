import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach as afterEachVitest, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { stocks } from './data/stocks'

describe('screener criteria controls', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => Promise.resolve(new Response(JSON.stringify(
      String(input).startsWith('/api/quotes')
        ? { quotes: [] }
        : { stocks, total: stocks.length, source: 'Test market' },
    )))))
  })
  afterEachVitest(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('uses live drag sliders for every numeric investment criterion', async () => {
    render(<App />)

    await waitFor(() => expect(screen.getByText('Test market')).toBeInTheDocument())

    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(6)
    sliders.forEach((slider) => expect(slider).toHaveAttribute('step', '1'))
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()

    const revenueSlider = screen.getByRole('slider', { name: 'Min. revenue growth' })
    fireEvent.change(revenueSlider, { target: { value: '30' } })

    expect(revenueSlider).toHaveValue('30')
    expect(screen.getByRole('button', { name: 'Filters 1' })).toBeInTheDocument()
    expect(screen.getByText('2', { selector: '.result-count strong' })).toBeInTheDocument()
  })

  it('sorts every data column and toggles between descending and ascending', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('Test market')).toBeInTheDocument())

    const sortableColumns = ['Company', 'Price', '1D performance', 'Market cap', 'Revenue growth', 'FCF growth', 'Gross margin', 'P/E', 'Signal']
    sortableColumns.forEach((column) => {
      expect(screen.getByRole('button', { name: `Sort by ${column}` })).toBeInTheDocument()
    })

    const revenueHeader = screen.getByRole('button', { name: 'Sort by Revenue growth' })
    const visibleTickers = () => Array.from(document.querySelectorAll('.table-row .company-cell strong')).map((node) => node.textContent)
    const descending = [...stocks].sort((a, b) => (b.revenueGrowth ?? Number.NEGATIVE_INFINITY) - (a.revenueGrowth ?? Number.NEGATIVE_INFINITY)).map((stock) => stock.ticker)
    const ascending = [...descending].reverse()

    fireEvent.click(revenueHeader)
    expect(visibleTickers()).toEqual(descending)
    expect(revenueHeader).toHaveAttribute('data-direction', 'desc')

    fireEvent.click(revenueHeader)
    expect(visibleTickers()).toEqual(ascending)
    expect(revenueHeader).toHaveAttribute('data-direction', 'asc')
  })

  it('never presents the 12 demo stocks or their prices when live market data fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'The market-data provider is temporarily unavailable.',
    }), { status: 502 })))

    render(<App />)

    await waitFor(() => expect(screen.getByText('Live data unavailable')).toBeInTheDocument())
    expect(screen.getByText('0', { selector: '.result-count strong' })).toBeInTheDocument()
    expect(screen.queryByText('AAPL', { selector: '.company-cell strong' })).not.toBeInTheDocument()
    expect(screen.queryByText('$182.70')).not.toBeInTheDocument()
  })

  it('leaves the loading state when the market API returns an empty universe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      stocks: [], total: 0, source: 'Business Quant', updatedAt: new Date().toISOString(),
    }))))

    render(<App />)

    await waitFor(() => expect(screen.getByText('Live data unavailable')).toBeInTheDocument())
    expect(screen.queryByText('Connecting…')).not.toBeInTheDocument()
  })

  it('keeps displayed table prices consistent with the snapshot used for global sorting', async () => {
    const universe = [
      { ...stocks[0], ticker: 'LOW', name: 'Low Price', price: 10 },
      { ...stocks[1], ticker: 'HIGH', name: 'High Price', price: 20 },
    ]
    const fetcher = vi.fn().mockImplementation((input: string) => {
      if (String(input).startsWith('/api/quotes')) {
        return Promise.resolve(new Response(JSON.stringify({
          quotes: [
            { ticker: 'LOW', price: 100, change: 5, sparkline: [90, 100] },
            { ticker: 'HIGH', price: 1, change: -5, sparkline: [2, 1] },
          ],
        })))
      }
      return Promise.resolve(new Response(JSON.stringify({
        stocks: universe, total: universe.length, source: 'Business Quant', updatedAt: new Date().toISOString(),
      })))
    })
    vi.stubGlobal('fetch', fetcher)

    const { container } = render(<App />)
    await waitFor(() => expect(screen.getByText('Business Quant')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Sort by Price' }))

    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/quotes?tickers=')))
    await waitFor(() => expect(
      Array.from(container.querySelectorAll('.table-row .table-price strong')).map((node) => node.textContent),
    ).toEqual(['$20.00', '$10.00']))
  })

  it('loads the full market and paginates large result sets without rendering thousands of rows', async () => {
    const fullMarket = Array.from({ length: 121 }, (_, index) => ({
      ...stocks[index % stocks.length],
      ticker: `T${String(index + 1).padStart(3, '0')}`,
      name: `Company ${index + 1}`,
      ...(index % 10 === 0 ? { revenueGrowth: null, earningsGrowth: null, fcfGrowth: null, pe: null, ps: null } : {}),
    }))
    const fetcher = vi.fn().mockImplementation((input: string) => {
      if (String(input).startsWith('/api/quotes')) {
        const tickers = decodeURIComponent(String(input)).split('tickers=')[1].split(',')
        return Promise.resolve(new Response(JSON.stringify({
          quotes: tickers.map((ticker) => ({ ticker, price: 123.45, change: 1.25, sparkline: [100, 103, 108, 112, 123.45] })),
        })))
      }
      return Promise.resolve(new Response(JSON.stringify({
        stocks: fullMarket, total: 121, source: 'Business Quant', updatedAt: new Date().toISOString(),
      })))
    })
    vi.stubGlobal('fetch', fetcher)

    const { container } = render(<App />)

    await waitFor(() => expect(screen.getByText('121', { selector: '.result-count strong' })).toBeInTheDocument())
    expect(container.querySelectorAll('.table-row')).toHaveLength(25)
    expect(screen.getByText('Business Quant')).toBeInTheDocument()
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/quotes?tickers=')))
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('range=1m'))
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('detail=summary'))
    expect(screen.queryByText('$123.45')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument()
  })

  it('renders reported fundamentals and labels missing values without sentinel numbers', async () => {
    const aapl = {
      ...stocks[0], ticker: 'AAPL', name: 'Apple Inc.', price: 311, change: null,
      marketCap: 4600.18652625, revenueGrowth: 14.2424, earningsGrowth: 29.865,
      fcfGrowth: 42.1058, grossMargin: 48.6529, pe: 35.6797, ps: 9.8542,
      insiderActivity: null, sparkline: [],
    }
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => Promise.resolve(new Response(JSON.stringify(
      String(input).startsWith('/api/quotes')
        ? { quotes: [] }
        : { stocks: [aapl], total: 1, source: 'Business Quant' },
    )))))

    render(<App />)

    await waitFor(() => expect(screen.getByText('14.2%')).toBeInTheDocument())
    expect(screen.getByText('42.1%')).toBeInTheDocument()
    expect(screen.getByText('48.7%')).toBeInTheDocument()
    expect(screen.getByText('35.7×')).toBeInTheDocument()
    expect(screen.getByText('N/A')).toBeInTheDocument()
    expect(screen.queryByText(/-999|999\.0/)).not.toBeInTheDocument()
  })

  it('switches chart ranges and reveals the hovered point price', async () => {
    const aapl = { ...stocks[0], ticker: 'AAPL', name: 'Apple Inc.' }
    const historyByRange: Record<string, Array<{ date: string; price: number }>> = {
      '1y': [{ date: '2025-08-07 16:00:00', price: 80 }, { date: '2026-08-07 16:00:00', price: 105 }],
      '1m': [
        { date: '2026-07-07 16:00:00', price: 90 },
        { date: '2026-07-22 16:00:00', price: 100 },
        { date: '2026-08-07 16:00:00', price: 110 },
      ],
    }
    const fetcher = vi.fn().mockImplementation((input: string) => {
      const url = String(input)
      if (url.startsWith('/api/quotes')) {
        const range = new URL(url, 'http://localhost').searchParams.get('range') ?? '1y'
        const history = historyByRange[range] ?? historyByRange['1y']
        return Promise.resolve(new Response(JSON.stringify({
          quotes: [{ ticker: 'AAPL', price: history.at(-1)!.price, change: 1.2, sparkline: history.map((point) => point.price), history }],
        })))
      }
      return Promise.resolve(new Response(JSON.stringify({ stocks: [aapl], total: 1, source: 'Business Quant' })))
    })
    vi.stubGlobal('fetch', fetcher)

    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('.table-row')).toBeInTheDocument())
    fireEvent.click(container.querySelector('.table-row')!)

    expect(['1 day', '1 month', '6 month', '1 year', '5 year'].map((range) => screen.getByRole('button', { name: `${range} price range` }))).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: '1 month price range' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('range=1m'), expect.objectContaining({ signal: expect.any(AbortSignal) })))
    expect(screen.getByRole('button', { name: '1 month price range' })).toHaveClass('active')

    const chart = await screen.findByRole('img', { name: /Price chart with 3 observations/ })
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, right: 600, bottom: 190, left: 0, width: 600, height: 190, toJSON: () => ({}),
    })
    Object.defineProperty(chart, 'getScreenCTM', { value: () => ({
      inverse: () => ({ a: 1.6, b: 0, c: 0, d: 1, e: -160, f: 0 }),
    }) })
    fireEvent.mouseMove(chart, { clientX: 150, clientY: 80 })

    expect(within(container.querySelector('.chart-hover')!).getByText('$90.00')).toBeInTheDocument()
    const priceAxis = container.querySelector('.price-axis')!
    expect(priceAxis.querySelectorAll('text')).toHaveLength(5)
    expect(priceAxis.textContent).toContain('$110.00')
    expect(priceAxis.textContent).toContain('$90.00')
  })
})
