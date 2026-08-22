import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { stocks } from './data/stocks'

const marketResponse = () => new Response(JSON.stringify({
  stocks,
  total: stocks.length,
  source: 'Test market',
  updatedAt: '2026-08-22T18:00:00.000Z',
}))

describe('resilient screener workflow', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('scrollTo', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows a dedicated loading state while the market request is pending', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))

    render(<App />)

    expect(screen.getByRole('status', { name: 'Loading market universe' })).toBeInTheDocument()
    expect(screen.queryByText('No companies match this screen')).not.toBeInTheDocument()
  })

  it('lets the user retry a failed initial market request', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Unavailable' }), { status: 502 }))
      .mockResolvedValueOnce(marketResponse())
      .mockResolvedValue(new Response(JSON.stringify({ quotes: [] })))
    vi.stubGlobal('fetch', fetcher)

    render(<App />)
    const retry = await screen.findByRole('button', { name: 'Retry market data' })
    fireEvent.click(retry)

    await waitFor(() => expect(screen.getByText('Test market')).toBeInTheDocument())
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/stocks')).toHaveLength(2)
  })

  it('starts with an honest empty watchlist and restores a saved local watchlist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => Promise.resolve(
      String(input).startsWith('/api/quotes')
        ? new Response(JSON.stringify({ quotes: [] }))
        : marketResponse(),
    )))

    const first = render(<App />)
    await screen.findByText('Test market')
    fireEvent.click(screen.getByRole('button', { name: 'Watchlist' }))
    expect(screen.getByText('Your watchlist is empty')).toBeInTheDocument()
    first.unmount()

    localStorage.setItem('signal.preferences.v1', JSON.stringify({ watchlist: [stocks[0].ticker] }))
    render(<App />)
    await screen.findByText('Test market')
    fireEvent.click(screen.getByRole('button', { name: 'Watchlist' }))
    expect(screen.getByText(stocks[0].ticker, { selector: '.company-cell strong' })).toBeInTheDocument()
  })

  it('shows score coverage on a company detail page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => Promise.resolve(
      String(input).startsWith('/api/quotes')
        ? new Response(JSON.stringify({ quotes: [] }))
        : marketResponse(),
    )))

    render(<App />)
    const ticker = await screen.findByText(stocks[0].ticker, { selector: '.company-cell strong' })
    fireEvent.click(ticker)

    expect(screen.getByText(/6 of 6 selected factors reported/i)).toBeInTheDocument()
  })

  it('separates opening a company from saving it and exposes control state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => Promise.resolve(
      String(input).startsWith('/api/quotes')
        ? new Response(JSON.stringify({ quotes: [] }))
        : marketResponse(),
    )))

    render(<App />)
    await screen.findByText('Test market')
    const ticker = stocks[0].ticker
    const save = screen.getByRole('button', { name: `Save ${ticker} to watchlist` })
    fireEvent.click(save)

    expect(screen.queryByRole('heading', { name: new RegExp(stocks[0].name) })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Remove ${ticker} from watchlist` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revenue growth' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Screener' })).toHaveAttribute('aria-current', 'page')

    fireEvent.click(screen.getByRole('button', { name: `Open ${ticker} details` }))
    expect(screen.getByRole('heading', { name: new RegExp(stocks[0].name) })).toBeInTheDocument()
  })

  it('supports visible sort direction and removable active criteria', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => Promise.resolve(
      String(input).startsWith('/api/quotes')
        ? new Response(JSON.stringify({ quotes: [] }))
        : marketResponse(),
    )))

    render(<App />)
    await screen.findByText('Test market')
    const direction = screen.getByRole('button', { name: 'Sort ascending' })
    fireEvent.click(direction)
    expect(screen.getByRole('button', { name: 'Sort descending' })).toBeInTheDocument()

    fireEvent.change(screen.getByRole('slider', { name: 'Min. revenue growth' }), { target: { value: '20' } })
    const remove = screen.getByRole('button', { name: 'Remove Min. revenue growth filter' })
    fireEvent.click(remove)
    expect(screen.queryByRole('button', { name: 'Remove Min. revenue growth filter' })).not.toBeInTheDocument()
  })

  it('offers export and omits unavailable insider ideas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => Promise.resolve(
      String(input).startsWith('/api/quotes')
        ? new Response(JSON.stringify({ quotes: [] }))
        : marketResponse(),
    )))

    render(<App />)
    await screen.findByText('Test market')
    expect(screen.getByRole('button', { name: 'Export filtered results as CSV' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ideas NEW' }))
    expect(screen.queryByText('Insiders leaning in')).not.toBeInTheDocument()
  })
})
