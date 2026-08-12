import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('notification status', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  // Regression: ISSUE-005 — notification button and unread dot were inert
  // Found by /qa on 2026-08-12
  // Report: .gstack/qa-reports/qa-report-localhost-2026-08-12.md
  it('explains the unavailable notification state when opened', () => {
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unavailable')))
    render(<App />)
    const button = screen.getByRole('button', { name: 'Notifications' })

    fireEvent.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Notifications aren’t connected yet')).toBeInTheDocument()
  })
})
