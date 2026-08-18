import { describe, expect, it, vi } from 'vitest'
import { QuoteRequestTracker } from './quoteRequests'

describe('QuoteRequestTracker', () => {
  it('releases missing quotes for a bounded retry instead of suppressing them forever', () => {
    let retry!: () => void
    const onRetry = vi.fn()
    const tracker = new QuoteRequestTracker({
      onRetry,
      schedule: (callback) => {
        retry = callback
        return 1
      },
      cancel: vi.fn(),
    })

    expect(tracker.claim(['AAPL'], () => false)).toEqual(['AAPL'])
    tracker.complete(['AAPL'], [])
    expect(tracker.claim(['AAPL'], () => false)).toEqual([])

    retry()
    expect(onRetry).toHaveBeenCalledOnce()
    expect(tracker.claim(['AAPL'], () => false)).toEqual(['AAPL'])
  })
})
