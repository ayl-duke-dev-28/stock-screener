export type MetricKey =
  | 'revenueGrowth'
  | 'earningsGrowth'
  | 'fcfGrowth'
  | 'grossMargin'
  | 'pe'
  | 'ps'
  | 'marketCap'
  | 'insiderActivity'

export type MarketCapFilter = 'all' | 'mega' | 'large' | 'mid' | 'small'

export interface Stock {
  ticker: string
  name: string
  sector: string
  price: number
  change: number
  marketCap: number
  revenueGrowth: number
  earningsGrowth: number
  fcfGrowth: number
  grossMargin: number
  pe: number
  ps: number
  insiderActivity: number
  sparkline: number[]
  thesis: string
}

export interface Filters {
  search: string
  sector: string
  marketCap: MarketCapFilter
  minRevenueGrowth: number
  minEarningsGrowth: number
  minFcfGrowth: number
  minGrossMargin: number
  maxPe: number
  maxPs: number
  insiderOnly: boolean
}

export interface ScoreBreakdown {
  growth: number
  quality: number
  valuation: number
  momentum: number
}

export interface ScoreResult {
  score: number
  breakdown: ScoreBreakdown
}
