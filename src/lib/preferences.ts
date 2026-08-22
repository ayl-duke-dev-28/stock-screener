import type { Filters, MetricKey } from '../types'

export const preferencesKey = 'signal.preferences.v1'

export type NumericFilterKey = 'minRevenueGrowth' | 'minEarningsGrowth' | 'minFcfGrowth' | 'minGrossMargin' | 'maxPe' | 'maxPs'
export type SortKey = 'company' | 'price' | 'change' | 'marketCap' | 'revenueGrowth' | 'fcfGrowth' | 'grossMargin' | 'pe' | 'score'
export type SortState = { key: SortKey; direction: 'asc' | 'desc' }

export const defaultFilters: Filters = {
  search: '', sector: 'All sectors', marketCap: 'all', minRevenueGrowth: 0,
  minEarningsGrowth: 0, minFcfGrowth: 0, minGrossMargin: 0,
  maxPe: 80, maxPs: 30, insiderOnly: false,
}

export const defaultPriorities: MetricKey[] = ['revenueGrowth', 'earningsGrowth', 'fcfGrowth', 'grossMargin', 'pe', 'ps']
export const defaultSort: SortState = { key: 'score', direction: 'desc' }

export interface Preferences {
  filters: Filters
  activeNumericFilters: NumericFilterKey[]
  priorities: MetricKey[]
  sort: SortState
  watchlist: string[]
}

const metricKeys = new Set<MetricKey>(['revenueGrowth', 'earningsGrowth', 'fcfGrowth', 'grossMargin', 'pe', 'ps', 'marketCap', 'insiderActivity'])
const numericKeys = new Set<NumericFilterKey>(['minRevenueGrowth', 'minEarningsGrowth', 'minFcfGrowth', 'minGrossMargin', 'maxPe', 'maxPs'])
const sortKeys = new Set<SortKey>(['company', 'price', 'change', 'marketCap', 'revenueGrowth', 'fcfGrowth', 'grossMargin', 'pe', 'score'])
const marketCaps = new Set<Filters['marketCap']>(['all', 'mega', 'large', 'mid', 'small'])

const defaults = (): Preferences => ({
  filters: { ...defaultFilters },
  activeNumericFilters: [],
  priorities: [...defaultPriorities],
  sort: { ...defaultSort },
  watchlist: [],
})

export function loadPreferences(storage: Pick<Storage, 'getItem'> = window.localStorage): Preferences {
  try {
    const raw = JSON.parse(storage.getItem(preferencesKey) ?? '{}') as Partial<Preferences>
    const filters: Partial<Filters> = raw.filters && typeof raw.filters === 'object' ? raw.filters : {}
    const result = defaults()
    if (typeof filters.search === 'string') result.filters.search = filters.search.slice(0, 100)
    if (typeof filters.sector === 'string') result.filters.sector = filters.sector.slice(0, 100)
    if (marketCaps.has(filters.marketCap as Filters['marketCap'])) result.filters.marketCap = filters.marketCap as Filters['marketCap']
    ;(['minRevenueGrowth', 'minEarningsGrowth', 'minFcfGrowth', 'minGrossMargin', 'maxPe', 'maxPs'] as const).forEach((key) => {
      if (typeof filters[key] === 'number' && Number.isFinite(filters[key])) result.filters[key] = filters[key]
    })
    if (typeof filters.insiderOnly === 'boolean') result.filters.insiderOnly = filters.insiderOnly
    if (Array.isArray(raw.activeNumericFilters)) result.activeNumericFilters = raw.activeNumericFilters.filter((key): key is NumericFilterKey => numericKeys.has(key as NumericFilterKey))
    if (Array.isArray(raw.priorities)) result.priorities = raw.priorities.filter((key): key is MetricKey => metricKeys.has(key as MetricKey))
    if (raw.sort && sortKeys.has(raw.sort.key) && (raw.sort.direction === 'asc' || raw.sort.direction === 'desc')) result.sort = raw.sort
    if (Array.isArray(raw.watchlist)) result.watchlist = Array.from(new Set(raw.watchlist.filter((ticker): ticker is string => typeof ticker === 'string' && /^[A-Z0-9.-]{1,15}$/.test(ticker)))).slice(0, 500)
    return result
  } catch {
    return defaults()
  }
}

export function savePreferences(preferences: Preferences, storage: Pick<Storage, 'setItem'> = window.localStorage) {
  try {
    storage.setItem(preferencesKey, JSON.stringify(preferences))
  } catch {
    // Storage can be disabled or full. The in-memory workflow still works.
  }
}
