import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { stocks } from './data/stocks'

describe('ticker search shortcut', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  // Regression: ISSUE-004 — the displayed Command-K shortcut did not focus search
  // Found by /qa on 2026-08-12
  // Report: .gstack/qa-reports/qa-report-localhost-2026-08-12.md
  it('returns to the screener and focuses ticker search', async () => {
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => Promise.resolve(new Response(JSON.stringify(
      String(input).startsWith('/api/quotes')
        ? { quotes: [] }
        : { stocks: [stocks[0]], total: 1, source: 'Test market' },
    )))))
    render(<App />)
    await waitFor(() => expect(screen.getByText('Test market')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Ideas/ }))

    fireEvent.keyDown(window, { key: 'k', metaKey: true })

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Search companies' })).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Screener' })).toHaveClass('active')
  })
})
