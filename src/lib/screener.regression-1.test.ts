import { describe, expect, it } from 'vitest'
import type { Stock } from '../types'
import { getRecommendations, scoreStock } from './screener'

const stock = (overrides: Partial<Stock>): Stock => ({
  ticker: 'TEST', name: 'Test Co', sector: 'Technology', price: 10, change: 1,
  marketCap: 1, revenueGrowth: null, earningsGrowth: null, fcfGrowth: null,
  grossMargin: null, pe: null, ps: null, insiderActivity: null, sparkline: [],
  thesis: 'Test company', ...overrides,
})

describe('recommendation confidence', () => {
  // Regression: ISSUE-002 — missing metrics and non-positive P/E produced 97–100 ratings
  // Found by /qa on 2026-08-12
  // Report: .gstack/qa-reports/qa-report-localhost-2026-08-12.md
  it('caps incomplete companies and rejects implausibly low P/E as a value signal', () => {
    const incomplete = stock({ ticker: 'MISS', fcfGrowth: 69.2, pe: -14.5, change: 7 })
    const complete = stock({
      ticker: 'FULL', revenueGrowth: 30, earningsGrowth: 35, fcfGrowth: 30,
      grossMargin: 70, pe: 15, ps: 4,
    })

    expect(scoreStock(incomplete).score).toBeLessThanOrEqual(60)
    expect(scoreStock(complete).score).toBeGreaterThan(scoreStock(incomplete).score)
    expect(scoreStock(stock({ pe: 0.1 }), ['pe']).score).toBeLessThan(scoreStock(stock({ pe: 10 }), ['pe']).score)
    expect(getRecommendations([incomplete], ['pe'])[0].reason).not.toContain('Attractive relative valuation')
  })
})
