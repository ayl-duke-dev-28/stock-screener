import { describe, expect, it } from 'vitest'
import {
  filterStocks,
  getRecommendations,
  scoreStock,
  scoreToLabel,
} from './screener'
import type { Stock } from '../types'

const strongStock: Stock = {
  ticker: 'GROW', name: 'Growth Co', sector: 'Technology', price: 100,
  change: 2.5, marketCap: 180, revenueGrowth: 28, earningsGrowth: 34,
  fcfGrowth: 30, grossMargin: 72, pe: 24, ps: 7, insiderActivity: 8,
  sparkline: [90, 93, 91, 96, 100], thesis: 'Compounding growth',
}

const valueStock: Stock = {
  ticker: 'VALU', name: 'Value Co', sector: 'Industrials', price: 52,
  change: -0.4, marketCap: 42, revenueGrowth: 7, earningsGrowth: 12,
  fcfGrowth: 15, grossMargin: 38, pe: 11, ps: 1.4, insiderActivity: 2,
  sparkline: [54, 53, 51, 52, 52], thesis: 'Undemanding valuation',
}

describe('scoreStock', () => {
  it('returns a bounded score and category breakdown', () => {
    const result = scoreStock(strongStock)
    expect(result.score).toBeGreaterThanOrEqual(1)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.breakdown).toEqual(expect.objectContaining({
      growth: expect.any(Number), quality: expect.any(Number),
      valuation: expect.any(Number), momentum: expect.any(Number),
    }))
    expect(result.coverage).toEqual({ available: 6, selected: 6, ratio: 1 })
  })

  it('reports low confidence when only a minority of selected factors are available', () => {
    const result = scoreStock({
      ...strongStock,
      earningsGrowth: null,
      fcfGrowth: null,
      grossMargin: null,
      pe: null,
      ps: null,
    })

    expect(result.coverage).toEqual({ available: 1, selected: 6, ratio: 1 / 6 })
    expect(result.score).toBeLessThanOrEqual(50)
  })

  it('changes weighting to match the selected screening criteria', () => {
    const growthScore = scoreStock(strongStock, ['revenueGrowth', 'earningsGrowth']).score
    const valueGrowthScore = scoreStock(valueStock, ['revenueGrowth', 'earningsGrowth']).score
    const valueScore = scoreStock(valueStock, ['pe', 'ps']).score
    const growthValueScore = scoreStock(strongStock, ['pe', 'ps']).score
    expect(growthScore).toBeGreaterThan(valueGrowthScore)
    expect(valueScore).toBeGreaterThan(growthValueScore)
  })

  it('maps score bands to readable labels', () => {
    expect(scoreToLabel(91)).toBe('Exceptional')
    expect(scoreToLabel(76)).toBe('Strong')
    expect(scoreToLabel(60)).toBe('Balanced')
    expect(scoreToLabel(40)).toBe('Watchlist')
    expect(scoreToLabel(91, 5 / 6)).toBe('Exceptional · partial data')
  })
})

describe('filterStocks', () => {
  it('applies search, sector, market cap, growth, margin, valuation, and insider filters', () => {
    const results = filterStocks([strongStock, valueStock], {
      search: 'grow', sector: 'Technology', marketCap: 'large',
      minRevenueGrowth: 20, minEarningsGrowth: 20, minFcfGrowth: 20,
      minGrossMargin: 50, maxPe: 30, maxPs: 10, insiderOnly: true,
    })
    expect(results.map((stock) => stock.ticker)).toEqual(['GROW'])
  })

  it('returns all stocks when no restrictive filters are active', () => {
    expect(filterStocks([strongStock, valueStock], {
      search: '', sector: 'All sectors', marketCap: 'all', minRevenueGrowth: 0,
      minEarningsGrowth: 0, minFcfGrowth: 0, minGrossMargin: 0,
      maxPe: 100, maxPs: 100, insiderOnly: false,
    })).toHaveLength(2)
  })

  it('matches ticker prefixes and company names, ignoring case and surrounding spaces', () => {
    const filters = {
      search: '  grow  ', sector: 'All sectors', marketCap: 'all' as const,
      minRevenueGrowth: 0, minEarningsGrowth: 0, minFcfGrowth: 0,
      minGrossMargin: 0, maxPe: 100, maxPs: 100, insiderOnly: false,
    }

    expect(filterStocks([strongStock, valueStock], filters).map((stock) => stock.ticker)).toEqual(['GROW'])
    expect(filterStocks([strongStock, valueStock], { ...filters, search: 'GRO' }).map((stock) => stock.ticker)).toEqual(['GROW'])
    expect(filterStocks([strongStock, valueStock], { ...filters, search: 'growth co' }).map((stock) => stock.ticker)).toEqual(['GROW'])
    expect(filterStocks([strongStock, valueStock], { ...filters, search: 'co' }).map((stock) => stock.ticker)).toEqual(['GROW', 'VALU'])
  })
})

describe('getRecommendations', () => {
  it('ranks every result and includes a reason', () => {
    const results = getRecommendations([valueStock, strongStock], ['revenueGrowth'])
    expect(results[0].stock.ticker).toBe('GROW')
    expect(results.every((item) => item.score >= 1 && item.reason.length > 0)).toBe(true)
    expect(results.every((item) => item.coverage.selected === 1)).toBe(true)
  })
})
