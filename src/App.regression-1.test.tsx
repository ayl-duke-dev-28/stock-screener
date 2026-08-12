import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('Ideas outage handling', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  // Regression: ISSUE-001 — Ideas crashed when no market recommendations existed
  // Found by /qa on 2026-08-12
  // Report: .gstack/qa-reports/qa-report-localhost-2026-08-12.md
  it('shows a safe empty state when market data fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 })))
    render(<App />)

    await waitFor(() => expect(screen.getByText('Live data unavailable')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Ideas/ }))

    expect(screen.getByRole('heading', { name: 'Ideas are temporarily unavailable.' })).toBeInTheDocument()
  })
})
