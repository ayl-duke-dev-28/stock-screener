import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach as afterEachVitest, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { stocks } from './data/stocks'

describe('screener criteria controls', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API not configured'))))
  afterEachVitest(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('uses live drag sliders for every numeric investment criterion', () => {
    render(<App />)

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
    await waitFor(() => expect(screen.getByText('Sample fallback')).toBeInTheDocument())

    const sortableColumns = ['Company', 'Price', 'Market cap', 'Revenue growth', 'FCF growth', 'Gross margin', 'P/E', 'Signal']
    sortableColumns.forEach((column) => {
      expect(screen.getByRole('button', { name: `Sort by ${column}` })).toBeInTheDocument()
    })

    const revenueHeader = screen.getByRole('button', { name: 'Sort by Revenue growth' })
    const visibleTickers = () => Array.from(document.querySelectorAll('.table-row .company-cell strong')).map((node) => node.textContent)
    const descending = [...stocks].sort((a, b) => b.revenueGrowth - a.revenueGrowth).map((stock) => stock.ticker)
    const ascending = [...descending].reverse()

    fireEvent.click(revenueHeader)
    expect(visibleTickers()).toEqual(descending)
    expect(revenueHeader).toHaveAttribute('data-direction', 'desc')

    fireEvent.click(revenueHeader)
    expect(visibleTickers()).toEqual(ascending)
    expect(revenueHeader).toHaveAttribute('data-direction', 'asc')
  })

  it('loads the full market and paginates large result sets without rendering thousands of rows', async () => {
    const fullMarket = Array.from({ length: 121 }, (_, index) => ({
      ...stocks[index % stocks.length],
      ticker: `T${String(index + 1).padStart(3, '0')}`,
      name: `Company ${index + 1}`,
      ...(index % 10 === 0 ? { revenueGrowth: -999, earningsGrowth: -999, fcfGrowth: -999, pe: 999, ps: 999 } : {}),
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
    expect(container.querySelectorAll('.table-row')).toHaveLength(50)
    expect(screen.getByText('Business Quant')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText('$123.45')).toHaveLength(50))
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/quotes?tickers='))

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
  })
})
