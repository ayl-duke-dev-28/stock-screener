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
})
