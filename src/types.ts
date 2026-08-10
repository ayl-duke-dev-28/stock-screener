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
  price: number | null
  change: number | null
  marketCap: number | null
  revenueGrowth: number | null
  earningsGrowth: number | null
  fcfGrowth: number | null
  grossMargin: number | null
  pe: number | null
  ps: number | null
  insiderActivity: number | null
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
