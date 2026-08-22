import type { Filters, MetricKey, ScoreBreakdown, ScoreResult, Stock } from '../types'

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const average = (values: Array<number | null>, fallback = 50) => {
  const available = values.filter((value): value is number => value !== null)
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : fallback
}

const metricScore = (stock: Stock, metric: MetricKey): number | null => {
  switch (metric) {
    case 'revenueGrowth': return stock.revenueGrowth === null ? null : clamp((stock.revenueGrowth + 5) * 2)
    case 'earningsGrowth': return stock.earningsGrowth === null ? null : clamp((stock.earningsGrowth + 10) * 1.65)
    case 'fcfGrowth': return stock.fcfGrowth === null ? null : clamp((stock.fcfGrowth + 10) * 1.7)
    case 'grossMargin': return stock.grossMargin === null ? null : clamp(stock.grossMargin * 1.25)
    case 'pe': return stock.pe === null ? null : stock.pe < 1 ? 0 : clamp(115 - stock.pe * 2.25)
    case 'ps': return stock.ps === null ? null : stock.ps <= 0 ? 0 : clamp(105 - stock.ps * 5)
    case 'marketCap': return stock.marketCap === null ? null : clamp(35 + Math.log10(Math.max(stock.marketCap, 1)) * 18)
    case 'insiderActivity': return stock.insiderActivity === null ? null : clamp(50 + stock.insiderActivity * 5)
  }
}

export function scoreStock(stock: Stock, priorities: MetricKey[] = []): ScoreResult {
  const selectedMetrics: MetricKey[] = priorities.length
    ? priorities
    : ['revenueGrowth', 'earningsGrowth', 'fcfGrowth', 'grossMargin', 'pe', 'ps']
  const selectedScores = selectedMetrics.map((key) => metricScore(stock, key))
  const available = selectedScores.filter((value) => value !== null).length
  const coverage = available / selectedScores.length
  const breakdown: ScoreBreakdown = {
    growth: Math.round(average([
      metricScore(stock, 'revenueGrowth'), metricScore(stock, 'earningsGrowth'), metricScore(stock, 'fcfGrowth'),
    ])),
    quality: Math.round(average([metricScore(stock, 'grossMargin'), metricScore(stock, 'fcfGrowth')])),
    valuation: Math.round(average([metricScore(stock, 'pe'), metricScore(stock, 'ps')])),
    momentum: Math.round(average([stock.change === null ? null : clamp(50 + stock.change * 8), metricScore(stock, 'insiderActivity')])),
  }
  const baseScore = breakdown.growth * 0.34 + breakdown.quality * 0.26 + breakdown.valuation * 0.25 + breakdown.momentum * 0.15
  const priorityScore = priorities.length ? average(selectedScores) : baseScore
  const rawScore = clamp(baseScore * 0.45 + priorityScore * 0.55, 1, 100)
  const confidenceCap = 40 + coverage * 60
  return {
    score: Math.round(Math.min(rawScore, confidenceCap)),
    breakdown,
    coverage: { available, selected: selectedScores.length, ratio: coverage },
  }
}

export function scoreToLabel(score: number, coverage = 1): string {
  const label = score >= 90 ? 'Exceptional' : score >= 75 ? 'Strong' : score >= 55 ? 'Balanced' : 'Watchlist'
  return coverage < 1 ? `${label} · partial data` : label
}

const fitsMarketCap = (value: number | null, filter: Filters['marketCap']) => {
  if (filter === 'all') return true
  if (value === null) return false
  if (filter === 'mega') return value >= 200
  if (filter === 'large') return value >= 10 && value < 200
  if (filter === 'mid') return value >= 2 && value < 10
  if (filter === 'small') return value < 2
  return false
}

const passesMinimum = (value: number | null, minimum: number) =>
  minimum === Number.NEGATIVE_INFINITY || (value !== null && value >= minimum)

const passesMaximum = (value: number | null, maximum: number) =>
  maximum === Number.POSITIVE_INFINITY || (value !== null && value <= maximum)

export function filterStocks(stocks: Stock[], filters: Filters): Stock[] {
  const query = filters.search.trim().toLowerCase()
  return stocks.filter((stock) =>
    (!query || stock.ticker.toLowerCase().startsWith(query) || stock.name.toLowerCase().includes(query)) &&
    (filters.sector === 'All sectors' || stock.sector === filters.sector) &&
    fitsMarketCap(stock.marketCap, filters.marketCap) &&
    passesMinimum(stock.revenueGrowth, filters.minRevenueGrowth) &&
    passesMinimum(stock.earningsGrowth, filters.minEarningsGrowth) &&
    passesMinimum(stock.fcfGrowth, filters.minFcfGrowth) &&
    passesMinimum(stock.grossMargin, filters.minGrossMargin) &&
    passesMaximum(stock.pe, filters.maxPe) &&
    passesMaximum(stock.ps, filters.maxPs) &&
    (!filters.insiderOnly || (stock.insiderActivity !== null && stock.insiderActivity > 0))
  )
}

export function getRecommendations(stocks: Stock[], priorities: MetricKey[] = []) {
  return stocks
    .map((stock) => {
      const result = scoreStock(stock, priorities)
      const strongest = Object.entries(result.breakdown).sort((a, b) => b[1] - a[1])[0][0]
      const reason = strongest === 'growth' && stock.revenueGrowth !== null
        ? `Top-tier growth profile with ${stock.revenueGrowth.toFixed(1)}% revenue growth`
        : strongest === 'quality' && stock.grossMargin !== null
          ? `High-quality economics and ${stock.grossMargin.toFixed(1)}% gross margin`
          : strongest === 'valuation' && stock.pe !== null && stock.pe >= 1
            ? `Attractive relative valuation at ${stock.pe.toFixed(1)}× earnings`
            : stock.change !== null
              ? `Positive market signal with ${stock.change.toFixed(1)}% recent momentum`
              : 'Ranked from the latest available reported fundamentals'
      return { stock, score: result.score, breakdown: result.breakdown, coverage: result.coverage, reason }
    })
    .sort((a, b) => b.score - a.score)
}
