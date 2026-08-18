import { describe, expect, it, vi } from 'vitest'
import type { MarketPayload, StockQuote } from './businessQuant'
import { MarketDataCoordinator, ProviderRetryCooldownError } from './marketData'

const marketPayload: MarketPayload = {
  stocks: [],
  total: 0,
  source: 'Business Quant',
  updatedAt: '2026-08-18T12:00:00.000Z',
}

describe('MarketDataCoordinator', () => {
  it('does not retry a failed cold-start market refresh until the cooldown expires', async () => {
    let now = 1_000
    const fetchMarket = vi.fn().mockRejectedValue(new Error('provider unavailable'))
    const coordinator = new MarketDataCoordinator({
      fetchMarket,
      fetchQuotes: vi.fn(),
      cacheTtlMs: 900_000,
      now: () => now,
    })

    await expect(coordinator.getMarket('secret')).rejects.toThrow('provider unavailable')
    await expect(coordinator.getMarket('secret')).rejects.toBeInstanceOf(ProviderRetryCooldownError)
    expect(fetchMarket).toHaveBeenCalledTimes(1)

    now += 900_001
    await expect(coordinator.getMarket('secret')).rejects.toThrow('provider unavailable')
    expect(fetchMarket).toHaveBeenCalledTimes(2)
  })

  it('coalesces overlapping quote requests for the same ticker and range', async () => {
    let resolveQuotes!: (quotes: StockQuote[]) => void
    const fetchQuotes = vi.fn().mockImplementation(() => new Promise<StockQuote[]>((resolve) => {
      resolveQuotes = resolve
    }))
    const coordinator = new MarketDataCoordinator({
      fetchMarket: vi.fn().mockResolvedValue(marketPayload),
      fetchQuotes,
    })

    const first = coordinator.getQuotes('secret', ['AAPL'], '1y')
    const second = coordinator.getQuotes('secret', ['AAPL'], '1y')

    expect(fetchQuotes).toHaveBeenCalledTimes(1)
    resolveQuotes([{ ticker: 'AAPL', price: 200, change: 1, sparkline: [190, 200], history: [] }])
    await expect(first).resolves.toEqual([expect.objectContaining({ ticker: 'AAPL' })])
    await expect(second).resolves.toEqual([expect.objectContaining({ ticker: 'AAPL' })])
  })

  it('briefly negative-caches missing quotes instead of repeatedly hitting the provider', async () => {
    const fetchQuotes = vi.fn().mockResolvedValue([])
    const coordinator = new MarketDataCoordinator({
      fetchMarket: vi.fn().mockResolvedValue(marketPayload),
      fetchQuotes,
    })

    await expect(coordinator.getQuotes('secret', ['MISSING'], '1y')).resolves.toEqual([])
    await expect(coordinator.getQuotes('secret', ['MISSING'], '1y')).resolves.toEqual([])
    expect(fetchQuotes).toHaveBeenCalledTimes(1)
  })
})
