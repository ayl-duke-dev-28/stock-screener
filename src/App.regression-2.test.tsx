import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { stocks } from './data/stocks'

describe('stock detail navigation', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  // Regression: ISSUE-003 — stock details inherited the screener scroll position
  // Found by /qa on 2026-08-12
  // Report: .gstack/qa-reports/qa-report-localhost-2026-08-12.md
  it('scrolls to the top when opening a stock', async () => {
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => Promise.resolve(new Response(JSON.stringify(
      String(input).startsWith('/api/quotes')
        ? { quotes: [] }
        : { stocks: [stocks[0]], total: 1, source: 'Test market' },
    )))))
    render(<App />)

    await waitFor(() => expect(screen.getByText(stocks[0].ticker, { selector: '.company-cell strong' })).toBeInTheDocument())
    scrollTo.mockClear()
    fireEvent.click(screen.getByText(stocks[0].ticker, { selector: '.company-cell strong' }))

    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 0))
  })
})
