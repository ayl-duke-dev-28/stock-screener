import type { Filters, MetricKey, ScoreBreakdown, ScoreResult, Stock } from '../types'

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

const metricScore = (stock: Stock, metric: MetricKey): number => {
  switch (metric) {
    case 'revenueGrowth': return clamp((stock.revenueGrowth + 5) * 2)
    case 'earningsGrowth': return clamp((stock.earningsGrowth + 10) * 1.65)
    case 'fcfGrowth': return clamp((stock.fcfGrowth + 10) * 1.7)
    case 'grossMargin': return clamp(stock.grossMargin * 1.25)
    case 'pe': return clamp(115 - stock.pe * 2.25)
    case 'ps': return clamp(105 - stock.ps * 5)
    case 'marketCap': return clamp(35 + Math.log10(Math.max(stock.marketCap, 1)) * 18)
    case 'insiderActivity': return clamp(50 + stock.insiderActivity * 5)
  }
}

export function scoreStock(stock: Stock, priorities: MetricKey[] = []): ScoreResult {
  const breakdown: ScoreBreakdown = {
    growth: Math.round(average([
      metricScore(stock, 'revenueGrowth'), metricScore(stock, 'earningsGrowth'), metricScore(stock, 'fcfGrowth'),
    ])),
    quality: Math.round(average([metricScore(stock, 'grossMargin'), metricScore(stock, 'fcfGrowth')])),
    valuation: Math.round(average([metricScore(stock, 'pe'), metricScore(stock, 'ps')])),
    momentum: Math.round(average([clamp(50 + stock.change * 8), metricScore(stock, 'insiderActivity')])),
  }
  const baseScore = breakdown.growth * 0.34 + breakdown.quality * 0.26 + breakdown.valuation * 0.25 + breakdown.momentum * 0.15
  const priorityScore = priorities.length ? average(priorities.map((key) => metricScore(stock, key))) : baseScore
  return { score: Math.round(clamp(baseScore * 0.45 + priorityScore * 0.55, 1, 100)), breakdown }
}

export function scoreToLabel(score: number): string {
  if (score >= 90) return 'Exceptional'
  if (score >= 75) return 'Strong'
  if (score >= 55) return 'Balanced'
  return 'Watchlist'
}

const fitsMarketCap = (value: number, filter: Filters['marketCap']) => {
  if (filter === 'mega') return value >= 200
  if (filter === 'large') return value >= 10 && value < 200
  if (filter === 'mid') return value >= 2 && value < 10
  if (filter === 'small') return value < 2
  return true
}

export function filterStocks(stocks: Stock[], filters: Filters): Stock[] {
  const query = filters.search.trim().toLowerCase()
  return stocks.filter((stock) =>
    (!query || stock.ticker.toLowerCase() === query) &&
    (filters.sector === 'All sectors' || stock.sector === filters.sector) &&
    fitsMarketCap(stock.marketCap, filters.marketCap) &&
    stock.revenueGrowth >= filters.minRevenueGrowth &&
    stock.earningsGrowth >= filters.minEarningsGrowth &&
    stock.fcfGrowth >= filters.minFcfGrowth &&
    stock.grossMargin >= filters.minGrossMargin &&
    stock.pe <= filters.maxPe &&
    stock.ps <= filters.maxPs &&
    (!filters.insiderOnly || stock.insiderActivity > 0)
  )
}

export function getRecommendations(stocks: Stock[], priorities: MetricKey[] = []) {
  return stocks
    .map((stock) => {
      const result = scoreStock(stock, priorities)
      const strongest = Object.entries(result.breakdown).sort((a, b) => b[1] - a[1])[0][0]
      const reason = strongest === 'growth'
        ? `Top-tier growth profile with ${stock.revenueGrowth.toFixed(1)}% revenue growth`
        : strongest === 'quality'
          ? `High-quality economics and ${stock.grossMargin.toFixed(1)}% gross margin`
          : strongest === 'valuation'
            ? `Attractive relative valuation at ${stock.pe.toFixed(1)}× earnings`
            : `Positive market signal with ${stock.change.toFixed(1)}% recent momentum`
      return { stock, score: result.score, breakdown: result.breakdown, reason }
    })
    .sort((a, b) => b.score - a.score)
}
