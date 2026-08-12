import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BarChart3, Bell,
  Bookmark, BookmarkCheck, Check, ChevronDown, CircleHelp, Filter, Lightbulb,
  ListFilter, Search, SlidersHorizontal, Sparkles, TrendingUp, X,
} from 'lucide-react'
import { filterStocks, getRecommendations, scoreStock, scoreToLabel } from './lib/screener'
import { paginate } from './lib/pagination'
import type { Filters, MetricKey, ScoreBreakdown, Stock } from './types'

const defaultFilters: Filters = {
  search: '', sector: 'All sectors', marketCap: 'all', minRevenueGrowth: 0,
  minEarningsGrowth: 0, minFcfGrowth: 0, minGrossMargin: 0,
  maxPe: 80, maxPs: 30, insiderOnly: false,
}

type NumericFilterKey = 'minRevenueGrowth' | 'minEarningsGrowth' | 'minFcfGrowth' | 'minGrossMargin' | 'maxPe' | 'maxPs'
type PricePoint = { date: string; price: number }
type Quote = { ticker: string; price: number; change: number; sparkline: number[]; history?: PricePoint[] }
type ChartRange = '1d' | '1m' | '6m' | '1y' | '5y'
type SortKey = 'company' | 'price' | 'change' | 'marketCap' | 'revenueGrowth' | 'fcfGrowth' | 'grossMargin' | 'pe' | 'score'
type SortDirection = 'asc' | 'desc'
type SortState = { key: SortKey; direction: SortDirection }

const numericFilterKeys = new Set<keyof Filters>([
  'minRevenueGrowth', 'minEarningsGrowth', 'minFcfGrowth', 'minGrossMargin', 'maxPe', 'maxPs',
])

const sortRecommendations = (recommendations: ReturnType<typeof getRecommendations>, sort: SortState) => {
  const direction = sort.direction === 'asc' ? 1 : -1
  return [...recommendations].sort((a, b) => {
    if (sort.key !== 'company' && sort.key !== 'score') {
      const left = a.stock[sort.key]
      const right = b.stock[sort.key]
      if (left === null && right === null) return a.stock.ticker.localeCompare(b.stock.ticker)
      if (left === null) return 1
      if (right === null) return -1
      return ((left - right) || a.stock.ticker.localeCompare(b.stock.ticker)) * direction
    }
    const comparison = sort.key === 'company'
      ? a.stock.ticker.localeCompare(b.stock.ticker)
      : a.score - b.score
    return (comparison || a.stock.ticker.localeCompare(b.stock.ticker)) * direction
  })
}

const metricOptions: { key: MetricKey; label: string }[] = [
  { key: 'revenueGrowth', label: 'Revenue growth' },
  { key: 'earningsGrowth', label: 'Earnings growth' },
  { key: 'fcfGrowth', label: 'Free cash flow' },
  { key: 'grossMargin', label: 'Gross margin' },
  { key: 'pe', label: 'P/E' },
  { key: 'ps', label: 'P/S' },
]

const scoreColor = (score: number) => score >= 75 ? '#16856b' : score >= 55 ? '#c0841a' : '#a45b52'
const formatMetric = (value: number | null, suffix: string, digits = 1) => value === null ? 'N/A' : `${value.toFixed(digits)}${suffix}`
const formatPrice = (value: number | null) => value === null ? 'N/A' : `$${value.toFixed(2)}`
const formatMarketCap = (value: number | null) => value === null ? 'N/A' : value >= 1000 ? `$${(value / 1000).toFixed(2)}T` : `$${value.toFixed(0)}B`
const exceeds = (value: number | null, threshold: number) => value !== null && value > threshold
const below = (value: number | null, threshold: number) => value !== null && value < threshold

const chartRanges: Array<{ key: ChartRange; label: string; title: string }> = [
  { key: '1d', label: '1D', title: 'Today’s intraday performance' },
  { key: '1m', label: '1M', title: '1 month trajectory' },
  { key: '6m', label: '6M', title: '6 month trajectory' },
  { key: '1y', label: '1Y', title: '1 year trajectory' },
  { key: '5y', label: '5Y', title: '5 year trajectory' },
]

const formatChartDate = (value: string, range: ChartRange) => {
  if (!value) return ''
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', range === '1d'
    ? { hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function Sparkline({ values, dates = [], range = '1y', positive = true, large = false }: { values: number[]; dates?: string[]; range?: ChartRange; positive?: boolean; large?: boolean }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  if (values.length < 2) return <span className={large ? 'hero-chart' : 'sparkline'} role="img" aria-label="Price trend unavailable">—</span>
  const width = large ? 640 : 92
  const height = large ? 190 : 34
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const constantPadding = rawMax === rawMin ? Math.max(Math.abs(rawMax) * 0.01, 0.01) : 0
  const min = rawMin - constantPadding
  const max = rawMax + constantPadding
  const valueRange = max - min || 1
  const plotLeft = large ? 8 : 0
  const plotRight = large ? width - 64 : width
  const plotTop = large ? 8 : 4
  const plotBottom = large ? height - 12 : height - 4
  const plotWidth = plotRight - plotLeft
  const plotHeight = plotBottom - plotTop
  const coordinates = values.map((value, index) => ({
    x: plotLeft + (index / (values.length - 1)) * plotWidth,
    y: plotBottom - ((value - min) / valueRange) * plotHeight,
  }))
  const axisTicks = large ? Array.from({ length: 5 }, (_, index) => ({
    value: max - (index / 4) * valueRange,
    y: plotTop + (index / 4) * plotHeight,
  })) : []
  const points = coordinates.map(({ x, y }) => `${x},${y}`).join(' ')
  const hovered = hoveredIndex === null ? null : coordinates[hoveredIndex]
  const hoveredValue = hoveredIndex === null ? null : values[hoveredIndex]
  const hoveredDate = hoveredIndex === null ? '' : formatChartDate(dates[hoveredIndex] ?? '', range)
  const tooltipX = hovered ? Math.min(plotRight - 70, Math.max(plotLeft + 70, hovered.x)) : 0
  return (
    <svg
      className={large ? 'hero-chart interactive-chart' : 'sparkline'}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={large ? 'Interactive price chart' : 'Price trend'}
      onMouseMove={large ? (event) => {
        let chartX: number
        const transform = event.currentTarget.getScreenCTM()
        if (transform) {
          const inverse = transform.inverse()
          chartX = inverse.a * event.clientX + inverse.c * event.clientY + inverse.e
        } else {
          const bounds = event.currentTarget.getBoundingClientRect()
          chartX = ((event.clientX - bounds.left) / (bounds.width || width)) * width
        }
        const relativeX = Math.min(1, Math.max(0, (chartX - plotLeft) / plotWidth))
        setHoveredIndex(Math.round(relativeX * (values.length - 1)))
      } : undefined}
      onMouseLeave={large ? () => setHoveredIndex(null) : undefined}
    >
      {large && <><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#16856b" stopOpacity=".22"/><stop offset="1" stopColor="#16856b" stopOpacity="0"/></linearGradient></defs><g className="price-axis">{axisTicks.map((tick) => <g key={tick.y}><line x1={plotLeft} x2={plotRight} y1={tick.y} y2={tick.y}/><text x={plotRight + 8} y={tick.y + 3}>{formatPrice(tick.value)}</text></g>)}</g><polygon points={`${plotLeft},${plotBottom} ${points} ${plotRight},${plotBottom}`} fill="url(#chartFill)" /></>}
      <polyline points={points} fill="none" stroke={positive ? '#16856b' : '#b45f55'} strokeWidth={large ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />
      {large && hovered && hoveredValue !== null && <g className="chart-hover">
        <line x1={hovered.x} x2={hovered.x} y1={plotTop} y2={plotBottom}/>
        <circle cx={hovered.x} cy={hovered.y} r="5"/>
        <g transform={`translate(${tooltipX - 62} 8)`}>
          <rect width="124" height={hoveredDate ? 42 : 27} rx="7"/>
          <text className="chart-tooltip-price" x="62" y="17">{formatPrice(hoveredValue)}</text>
          {hoveredDate && <text className="chart-tooltip-date" x="62" y="32">{hoveredDate}</text>}
        </g>
      </g>}
    </svg>
  )
}

function ScoreBadge({ score, size = 'small' }: { score: number; size?: 'small' | 'large' }) {
  const color = scoreColor(score)
  return <div className={`score-badge ${size}`} style={{ '--score-color': color } as React.CSSProperties}><span>{score}</span>{size === 'large' && <small>/ 100</small>}</div>
}

function SliderField({ label, value, min, max, step, suffix, onChange }: { label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (value: number) => void }) {
  const progress = ((value - min) / (max - min)) * 100
  return <label className="slider-field">
    <span><span>{label}</span><strong>{value}{suffix}</strong></span>
    <input
      aria-label={label}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ '--slider-progress': `${progress}%` } as React.CSSProperties}
      onChange={(event) => onChange(Number(event.target.value))}
    />
    <small><span>{min}{suffix}</span><span>{max}{suffix}</span></small>
  </label>
}

function BreakdownBars({ breakdown }: { breakdown: ScoreBreakdown }) {
  return <div className="breakdown-bars">{Object.entries(breakdown).map(([label, value]) => <div className="breakdown-row" key={label}><span>{label}</span><div><i style={{ width: `${value}%`, background: scoreColor(value) }}/></div><b>{value}</b></div>)}</div>
}

function StockDetail({ stock, priorities, isSaved, onBack, onToggleSave }: { stock: Stock; priorities: MetricKey[]; isSaved: boolean; onBack: () => void; onToggleSave: () => void }) {
  const result = scoreStock(stock, priorities)
  const [chartRange, setChartRange] = useState<ChartRange>('1y')
  const [chartHistory, setChartHistory] = useState<PricePoint[]>(stock.sparkline.map((price) => ({ date: '', price })))
  const [chartLoading, setChartLoading] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setChartLoading(true)
    fetch(`/api/quotes?tickers=${encodeURIComponent(stock.ticker)}&range=${chartRange}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Chart data unavailable')
        return response.json() as Promise<{ quotes: Quote[] }>
      })
      .then((payload) => {
        const quote = payload.quotes?.[0]
        if (!quote) return
        setChartHistory(quote.history ?? quote.sparkline.map((price) => ({ date: '', price })))
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setChartHistory([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setChartLoading(false)
      })
    return () => controller.abort()
  }, [chartRange, stock.ticker])
  const chartStart = chartHistory[0]?.price
  const chartEnd = chartHistory.at(-1)?.price
  const chartPerformance = chartStart && chartEnd ? ((chartEnd - chartStart) / chartStart) * 100 : null
  const selectedRange = chartRanges.find(({ key }) => key === chartRange)!
  const metrics: Array<[string, string, boolean | null]> = [
    ['Revenue growth', formatMetric(stock.revenueGrowth, '%'), stock.revenueGrowth === null ? null : exceeds(stock.revenueGrowth, 15)],
    ['Earnings growth', formatMetric(stock.earningsGrowth, '%'), stock.earningsGrowth === null ? null : exceeds(stock.earningsGrowth, 15)],
    ['Free cash flow growth', formatMetric(stock.fcfGrowth, '%'), stock.fcfGrowth === null ? null : exceeds(stock.fcfGrowth, 15)],
    ['Gross margin', formatMetric(stock.grossMargin, '%'), stock.grossMargin === null ? null : exceeds(stock.grossMargin, 50)],
    ['P/E ratio', formatMetric(stock.pe, '×'), stock.pe === null ? null : below(stock.pe, 30)],
    ['P/S ratio', formatMetric(stock.ps, '×'), stock.ps === null ? null : below(stock.ps, 8)],
  ]
  return <main className="detail-page">
    <button className="back-button" onClick={onBack}><ArrowLeft size={16}/> Back to screener</button>
    <section className="detail-header">
      <div className="company-heading"><div className="company-logo large-logo">{stock.ticker.slice(0, 1)}</div><div><div className="eyebrow">{stock.sector}</div><h1>{stock.name} <span>{stock.ticker}</span></h1><div className="detail-price">{formatPrice(stock.price)} {stock.change !== null && <span className={stock.change >= 0 ? 'positive' : 'negative'}>{stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%</span>}</div></div></div>
      <button className={`save-button ${isSaved ? 'saved' : ''}`} onClick={onToggleSave}>{isSaved ? <BookmarkCheck size={17}/> : <Bookmark size={17}/>} {isSaved ? 'Saved' : 'Add to watchlist'}</button>
    </section>
    <section className="detail-grid">
      <div className="chart-card card"><div className="card-heading"><div><span className="eyebrow">Price performance {chartPerformance !== null && <em className={chartPerformance >= 0 ? 'positive' : 'negative'}>{chartPerformance >= 0 ? '+' : ''}{chartPerformance.toFixed(2)}%</em>}</span><h2>{selectedRange.title}</h2></div><div className="range-tabs">{chartRanges.map(({ key, label }) => <button type="button" className={chartRange === key ? 'active' : ''} onClick={() => setChartRange(key)} key={key}>{label}</button>)}</div></div>{chartLoading && !chartHistory.length ? <div className="chart-loading">Loading price history…</div> : <Sparkline values={chartHistory.map(({ price }) => price)} dates={chartHistory.map(({ date }) => date)} range={chartRange} positive={chartPerformance === null || chartPerformance >= 0} large/>}</div>
      <div className="rating-card card"><span className="eyebrow">Signal rating</span><div className="rating-main"><ScoreBadge score={result.score} size="large"/><div><h2>{scoreToLabel(result.score)}</h2><p>Based on up to {priorities.length || 6} selected criteria with available data</p></div></div><BreakdownBars breakdown={result.breakdown}/></div>
    </section>
    <section className="analysis-grid">
      <div className="card metric-card"><div className="card-heading"><div><span className="eyebrow">Fundamentals</span><h2>Scorecard</h2></div><span className="live-dot"><i/> Latest reported</span></div><div className="metric-list">{metrics.map(([label, value, good]) => <div key={String(label)}><span>{label}</span><strong>{value}</strong><em className={good ? 'metric-good' : 'metric-neutral'}>{good === null ? 'Not reported' : good ? 'Above benchmark' : 'Within range'}</em></div>)}</div></div>
      <div className="card thesis-card"><span className="eyebrow">Investment lens</span><h2>Why it stands out</h2><p className="thesis-lead">{stock.thesis}</p><div className="thesis-point"><Check size={16}/><p><strong>Growth signal</strong><br/>Revenue and earnings trends are evaluated against the current screened universe.</p></div><div className="thesis-point"><Check size={16}/><p><strong>Valuation context</strong><br/>Multiples are scored inversely and balanced against business quality.</p></div><div className="thesis-note"><CircleHelp size={15}/> Scores are research aids, not investment advice.</div></div>
    </section>
  </main>
}

export default function App() {
  const [view, setView] = useState<'screener' | 'ideas' | 'watchlist'>('screener')
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [priorities, setPriorities] = useState<MetricKey[]>(['revenueGrowth', 'earningsGrowth', 'fcfGrowth', 'grossMargin', 'pe', 'ps'])
  const [filterOpen, setFilterOpen] = useState(true)
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null)
  const [watchlist, setWatchlist] = useState<string[]>(['MSFT', 'UBER'])
  const [sort, setSort] = useState<SortState>({ key: 'score', direction: 'desc' })
  const [marketStocks, setMarketStocks] = useState<Stock[]>([])
  const [dataSource, setDataSource] = useState<'loading' | 'live' | 'cached' | 'error'>('loading')
  const [sourceLabel, setSourceLabel] = useState('Connecting…')
  const [page, setPage] = useState(1)
  const [activeNumericFilters, setActiveNumericFilters] = useState<Set<NumericFilterKey>>(new Set())
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const requestedQuotes = useRef(new Set<string>())
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [selectedStock, view])

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSelectedStock(null)
        setView('screener')
        requestAnimationFrame(() => searchInputRef.current?.focus())
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/stocks')
      .then(async (response) => {
        if (!response.ok) throw new Error('Market API unavailable')
        return response.json() as Promise<{ stocks: Stock[]; source: string; stale?: boolean }>
      })
      .then((payload) => {
        if (!active || !payload.stocks?.length) return
        setMarketStocks(payload.stocks.map((stock) => ({ ...stock, sector: stock.sector.trim() || 'Unclassified' })))
        setSourceLabel(payload.source)
        setDataSource(payload.stale ? 'cached' : 'live')
      })
      .catch(() => {
        if (!active) return
        setMarketStocks([])
        setSourceLabel('Live data unavailable')
        setDataSource('error')
      })
    return () => { active = false }
  }, [])

  const availableSectors = useMemo(() => ['All sectors', ...Array.from(new Set(marketStocks.map((stock) => stock.sector))).sort()], [marketStocks])
  const appliedFilters = useMemo<Filters>(() => ({
    ...filters,
    minRevenueGrowth: activeNumericFilters.has('minRevenueGrowth') ? filters.minRevenueGrowth : Number.NEGATIVE_INFINITY,
    minEarningsGrowth: activeNumericFilters.has('minEarningsGrowth') ? filters.minEarningsGrowth : Number.NEGATIVE_INFINITY,
    minFcfGrowth: activeNumericFilters.has('minFcfGrowth') ? filters.minFcfGrowth : Number.NEGATIVE_INFINITY,
    minGrossMargin: activeNumericFilters.has('minGrossMargin') ? filters.minGrossMargin : Number.NEGATIVE_INFINITY,
    maxPe: activeNumericFilters.has('maxPe') ? filters.maxPe : Number.POSITIVE_INFINITY,
    maxPs: activeNumericFilters.has('maxPs') ? filters.maxPs : Number.POSITIVE_INFINITY,
  }), [activeNumericFilters, filters])
  const filtered = useMemo(() => filterStocks(marketStocks, appliedFilters), [marketStocks, appliedFilters])
  const ranked = useMemo(() => {
    const recommendations = getRecommendations(filtered, priorities)
    return sortRecommendations(recommendations, sort)
  }, [filtered, priorities, sort])
  const pagedResults = useMemo(() => paginate(ranked, page, 50), [ranked, page])
  useEffect(() => setPage(1), [filters, priorities, sort])
  const activeFilterCount = activeNumericFilters.size + [filters.sector !== defaultFilters.sector, filters.marketCap !== defaultFilters.marketCap, filters.insiderOnly].filter(Boolean).length

  const quoteTargets = useMemo(() => {
    if (dataSource !== 'live' && dataSource !== 'cached') return []
    if (selectedStock) return [selectedStock.ticker]
    if (view === 'watchlist') return watchlist
    if (view === 'screener') return pagedResults.items.map(({ stock }) => stock.ticker)
    return []
  }, [dataSource, pagedResults.items, selectedStock, view, watchlist])

  useEffect(() => {
    const pending = quoteTargets.filter((ticker) => !quotes[ticker] && !requestedQuotes.current.has(ticker)).slice(0, 50)
    if (!pending.length) return
    pending.forEach((ticker) => requestedQuotes.current.add(ticker))
    fetch(`/api/quotes?tickers=${encodeURIComponent(pending.join(','))}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Quote API unavailable')
        return response.json() as Promise<{ quotes: Quote[] }>
      })
      .then((payload) => setQuotes((current) => ({
        ...current,
        ...Object.fromEntries((payload.quotes ?? []).map((quote) => [quote.ticker, quote])),
      })))
      .catch(() => pending.forEach((ticker) => requestedQuotes.current.delete(ticker)))
  }, [quoteTargets, quotes])

  const withQuote = (stock: Stock) => quotes[stock.ticker] ? { ...stock, ...quotes[stock.ticker] } : stock
  const displayedPage = useMemo(() => pagedResults.items.map((result) => ({ ...result, stock: withQuote(result.stock) })), [pagedResults.items, quotes])
  const quotedUniverse = useMemo(() => marketStocks.map(withQuote), [marketStocks, quotes])

  const patchFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }))
    if (numericFilterKeys.has(key)) setActiveNumericFilters((current) => new Set(current).add(key as NumericFilterKey))
  }
  const resetFilters = () => {
    setFilters(defaultFilters)
    setActiveNumericFilters(new Set())
  }
  const changeSort = (key: SortKey) => setSort((current) => ({
    key,
    direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
  }))
  const togglePriority = (key: MetricKey) => setPriorities((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  const toggleWatchlist = (ticker: string) => setWatchlist((current) => current.includes(ticker) ? current.filter((item) => item !== ticker) : [...current, ticker])

  if (selectedStock) return <div className="app-shell"><TopBar view={view} setView={(next) => { setView(next); setSelectedStock(null) }}/><StockDetail stock={withQuote(selectedStock)} priorities={priorities} isSaved={watchlist.includes(selectedStock.ticker)} onBack={() => setSelectedStock(null)} onToggleSave={() => toggleWatchlist(selectedStock.ticker)}/></div>

  return <div className="app-shell">
    <TopBar view={view} setView={setView}/>
    <main className="dashboard">
      {view === 'screener' && <>
        <section className="page-title"><div><span className="eyebrow">Equity research workspace</span><h1>Find signal in the market.</h1><p>Screen the universe, rank what matters, and investigate the strongest ideas.</p></div><div className={`as-of ${dataSource}`}><span><i/> {dataSource === 'live' ? 'Full US universe' : dataSource === 'cached' ? 'Cached US universe' : 'Market data'}</span><strong>{sourceLabel}</strong><small>{dataSource === 'loading' ? 'Loading listed equities' : dataSource === 'live' ? `${marketStocks.length.toLocaleString()} companies loaded` : dataSource === 'cached' ? `${marketStocks.length.toLocaleString()} companies · last known snapshot` : 'Provider unavailable; no demo prices shown'}</small></div></section>
        <section className="toolbar card"><div className="search-box"><Search size={18}/><input ref={searchInputRef} aria-label="Search companies" placeholder="Enter exact ticker (e.g. AAPL)" value={filters.search} onChange={(event) => patchFilter('search', event.target.value)}/><kbd>⌘ K</kbd></div><button className={`filter-button ${filterOpen ? 'active' : ''}`} onClick={() => setFilterOpen(!filterOpen)}><SlidersHorizontal size={17}/> Filters {activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button><div className="toolbar-divider"/><span className="result-count"><strong>{ranked.length}</strong> companies</span></section>
        {filterOpen && <section className="filter-panel card">
          <div className="filter-panel-head"><div><ListFilter size={17}/><strong>Refine universe</strong></div><button onClick={resetFilters}>Reset all</button></div>
          <div className="filter-grid"><label className="select-field"><span>Sector</span><div><select value={filters.sector} onChange={(event) => patchFilter('sector', event.target.value)}>{availableSectors.map((sector) => <option key={sector}>{sector}</option>)}</select><ChevronDown size={14}/></div></label><label className="select-field"><span>Market cap</span><div><select value={filters.marketCap} onChange={(event) => patchFilter('marketCap', event.target.value as Filters['marketCap'])}><option value="all">Any size</option><option value="mega">Mega cap ($200B+)</option><option value="large">Large cap ($10–200B)</option><option value="mid">Mid cap ($2–10B)</option><option value="small">Small cap (&lt;$2B)</option></select><ChevronDown size={14}/></div></label><SliderField label="Min. revenue growth" value={filters.minRevenueGrowth} min={-10} max={60} step={1} suffix="%" onChange={(value) => patchFilter('minRevenueGrowth', value)}/><SliderField label="Min. earnings growth" value={filters.minEarningsGrowth} min={-20} max={80} step={1} suffix="%" onChange={(value) => patchFilter('minEarningsGrowth', value)}/><SliderField label="Min. FCF growth" value={filters.minFcfGrowth} min={-20} max={60} step={1} suffix="%" onChange={(value) => patchFilter('minFcfGrowth', value)}/><SliderField label="Min. gross margin" value={filters.minGrossMargin} min={0} max={90} step={1} suffix="%" onChange={(value) => patchFilter('minGrossMargin', value)}/><SliderField label="Max. P/E ratio" value={filters.maxPe} min={5} max={80} step={1} suffix="×" onChange={(value) => patchFilter('maxPe', value)}/><SliderField label="Max. P/S ratio" value={filters.maxPs} min={1} max={30} step={1} suffix="×" onChange={(value) => patchFilter('maxPs', value)}/></div>
          <div className="priority-row"><div><span>Score priorities</span><small>Ratings adapt to what matters to you</small></div><div className="priority-chips">{metricOptions.map(({ key, label }) => <button className={priorities.includes(key) ? 'selected' : ''} onClick={() => togglePriority(key)} key={key}>{priorities.includes(key) && <Check size={12}/>} {label}</button>)}</div><label className="toggle" title={dataSource === 'live' || dataSource === 'cached' ? 'The current screener feed does not include insider transactions yet.' : undefined}><input type="checkbox" disabled={dataSource === 'live' || dataSource === 'cached'} checked={filters.insiderOnly} onChange={(event) => patchFilter('insiderOnly', event.target.checked)}/><span/><em>{dataSource === 'live' || dataSource === 'cached' ? 'Insider data not connected' : 'Insider buying only'}</em></label></div>
        </section>}
        <section className="results-header"><div><h2>Ranked companies</h2><p>Click any column heading to change the ranking</p></div><label>Sort by <select value={sort.key} onChange={(event) => setSort({ key: event.target.value as SortKey, direction: 'desc' })}><option value="score">Signal score</option><option value="company">Company</option><option value="price">Price</option><option value="change">1D performance</option><option value="marketCap">Market cap</option><option value="revenueGrowth">Revenue growth</option><option value="fcfGrowth">FCF growth</option><option value="grossMargin">Gross margin</option><option value="pe">P/E</option></select></label></section>
        {dataSource === 'error'
          ? <div className="empty card"><Filter size={28}/><h3>Market data is temporarily unavailable</h3><p>The live provider could not return verified stocks or prices. Try again after its API allowance resets.</p></div>
          : <StockTable ranked={displayedPage} watchlist={watchlist} sort={sort} onSort={changeSort} onOpen={setSelectedStock} onToggleSave={toggleWatchlist}/>}
        {ranked.length > 0 && <Pagination page={pagedResults.page} pageCount={pagedResults.pageCount} total={pagedResults.total} onPage={setPage}/>} 
      </>}
      {view === 'ideas' && <Ideas universe={quotedUniverse} priorities={priorities} onOpen={setSelectedStock}/>}
      {view === 'watchlist' && <Watchlist universe={quotedUniverse} tickers={watchlist} priorities={priorities} sort={sort} onSort={changeSort} onOpen={setSelectedStock} onToggleSave={toggleWatchlist}/>}
    </main>
  </div>
}

function Pagination({ page, pageCount, total, onPage }: { page: number; pageCount: number; total: number; onPage: (page: number) => void }) {
  return <nav className="pagination" aria-label="Stock results pagination"><span>Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total.toLocaleString()}</span><div><button aria-label="Previous page" disabled={page === 1} onClick={() => onPage(page - 1)}><ArrowLeft size={15}/></button><strong>Page {page} of {pageCount}</strong><button aria-label="Next page" disabled={page === pageCount} onClick={() => onPage(page + 1)}><ArrowRight size={15}/></button></div></nav>
}

function TopBar({ view, setView }: { view: string; setView: (view: 'screener' | 'ideas' | 'watchlist') => void }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  return <header className="topbar"><button className="brand" onClick={() => setView('screener')}><span><TrendingUp/></span>SIGNAL</button><nav><button className={view === 'screener' ? 'active' : ''} onClick={() => setView('screener')}>Screener</button><button className={view === 'ideas' ? 'active' : ''} onClick={() => setView('ideas')}>Ideas <small>NEW</small></button><button className={view === 'watchlist' ? 'active' : ''} onClick={() => setView('watchlist')}>Watchlist</button></nav><div className="top-actions"><button aria-label="Notifications" aria-expanded={notificationsOpen} aria-controls="notification-status" onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18}/></button>{notificationsOpen && <div className="notification-popover" id="notification-status" role="status"><CircleHelp size={17}/><div><strong>Notifications aren’t connected yet</strong><small>Market and watchlist alerts will appear here when enabled.</small></div></div>}<div className="avatar">AL</div></div></header>
}

function StockTable({ ranked, watchlist, sort, onSort, onOpen, onToggleSave }: { ranked: ReturnType<typeof getRecommendations>; watchlist: string[]; sort: SortState; onSort: (key: SortKey) => void; onOpen: (stock: Stock) => void; onToggleSave: (ticker: string) => void }) {
  if (!ranked.length) return <div className="empty card"><Filter size={28}/><h3>No companies match this screen</h3><p>Try widening one or two filters to bring more of the market back into view.</p></div>
  const columns: { key: SortKey; label: string; accessibleLabel: string }[] = [
    { key: 'company', label: 'Company', accessibleLabel: 'Company' },
    { key: 'price', label: 'Price', accessibleLabel: 'Price' },
    { key: 'change', label: '1D performance', accessibleLabel: '1D performance' },
    { key: 'marketCap', label: 'Market cap', accessibleLabel: 'Market cap' },
    { key: 'revenueGrowth', label: 'Revenue', accessibleLabel: 'Revenue growth' },
    { key: 'fcfGrowth', label: 'FCF growth', accessibleLabel: 'FCF growth' },
    { key: 'grossMargin', label: 'Gross margin', accessibleLabel: 'Gross margin' },
    { key: 'pe', label: 'P/E', accessibleLabel: 'P/E' },
    { key: 'score', label: 'Signal', accessibleLabel: 'Signal' },
  ]
  return <section className="table-card card"><div className="stock-table table-head">{columns.map((column) => { const active = sort.key === column.key; return <button type="button" aria-label={`Sort by ${column.accessibleLabel}`} className={active ? 'active' : ''} data-direction={active ? sort.direction : undefined} onClick={() => onSort(column.key)} key={column.key}><span>{column.label}</span>{active && (sort.direction === 'desc' ? <ArrowDown/> : <ArrowUp/>)}</button> })}<span/></div>{ranked.map(({ stock, score }) => <button className="stock-table table-row" key={stock.ticker} onClick={() => onOpen(stock)}><span className="company-cell"><i className="company-logo">{stock.ticker[0]}</i><span><strong>{stock.ticker}</strong><small>{stock.name}</small></span></span><span className="table-price"><strong>{formatPrice(stock.price)}</strong></span><span className="performance-cell">{stock.change === null ? <small>N/A</small> : <small className={stock.change >= 0 ? 'positive' : 'negative'}>{stock.change >= 0 ? <ArrowUpRight/> : <ArrowDownRight/>}{Math.abs(stock.change).toFixed(2)}%</small>}<Sparkline values={stock.sparkline} positive={stock.change === null || stock.change >= 0}/></span><span>{formatMarketCap(stock.marketCap)}</span><span className={exceeds(stock.revenueGrowth, 15) ? 'metric-good' : ''}>{formatMetric(stock.revenueGrowth, '%')}</span><span className={exceeds(stock.fcfGrowth, 15) ? 'metric-good' : ''}>{formatMetric(stock.fcfGrowth, '%')}</span><span>{formatMetric(stock.grossMargin, '%')}</span><span>{formatMetric(stock.pe, '×')}</span><span className="signal-cell"><ScoreBadge score={score}/><span><strong>{scoreToLabel(score)}</strong><small>of 100</small></span></span><span className="row-actions"><i onClick={(event) => { event.stopPropagation(); onToggleSave(stock.ticker) }}>{watchlist.includes(stock.ticker) ? <BookmarkCheck/> : <Bookmark/>}</i><ArrowRight/></span></button>)}</section>
}

function Ideas({ universe, priorities, onOpen }: { universe: Stock[]; priorities: MetricKey[]; onOpen: (stock: Stock) => void }) {
  if (!universe.length) return <section className="simple-hero ideas-empty"><span className="eyebrow"><Sparkles size={14}/> Signal ideas</span><h1>Ideas are temporarily unavailable.</h1><p>Verified market data is required before Signal can rank companies.</p></section>
  const themes = [
    { title: 'Profitable compounders', tag: 'Quality growth', copy: 'Strong top-line growth, expanding cash generation, and durable margins.', color: 'sage', picks: getRecommendations(universe.filter((s) => exceeds(s.revenueGrowth, 15) && exceeds(s.fcfGrowth, 18) && s.grossMargin !== null), ['revenueGrowth', 'fcfGrowth', 'grossMargin']).slice(0, 3) },
    { title: 'Growth at a fair price', tag: 'GARP', copy: 'Above-market earnings growth without the most demanding valuation multiples.', color: 'sand', picks: getRecommendations(universe.filter((s) => exceeds(s.earningsGrowth, 20) && s.pe !== null && s.pe >= 1 && below(s.pe, 35) && s.ps !== null && s.ps > 0), ['earningsGrowth', 'pe', 'ps']).slice(0, 3) },
    { title: 'Insiders leaning in', tag: 'Smart money', copy: 'Positive insider activity paired with improving fundamental momentum.', color: 'blue', picks: getRecommendations(universe.filter((s) => exceeds(s.insiderActivity, 3)), ['insiderActivity', 'earningsGrowth']).slice(0, 3) },
  ]
  const top = getRecommendations(universe, priorities)[0]
  return <><section className="ideas-hero"><div><span className="eyebrow"><Sparkles size={14}/> Signal ideas</span><h1>A sharper place to start.</h1><p>Curated research themes built from fundamental signals—not hype.</p></div><div className="idea-feature card"><span>Highest conviction today</span><div><div className="company-logo">{top.stock.ticker[0]}</div><div><strong>{top.stock.ticker}</strong><small>{top.stock.name}</small></div><ScoreBadge score={top.score}/><button onClick={() => onOpen(top.stock)}>View thesis <ArrowRight/></button></div></div></section><section className="theme-grid">{themes.map((theme) => <article className={`theme-card card ${theme.color}`} key={theme.title}><span className="theme-tag">{theme.tag}</span><h2>{theme.title}</h2><p>{theme.copy}</p><div className="theme-picks">{theme.picks.map((pick) => <button key={pick.stock.ticker} onClick={() => onOpen(pick.stock)}><span><i className="company-logo">{pick.stock.ticker[0]}</i><span><strong>{pick.stock.ticker}</strong><small>{pick.reason}</small></span></span><span><ScoreBadge score={pick.score}/><ArrowRight/></span></button>)}</div></article>)}</section></>
}

function Watchlist({ universe, tickers, priorities, sort, onSort, onOpen, onToggleSave }: { universe: Stock[]; tickers: string[]; priorities: MetricKey[]; sort: SortState; onSort: (key: SortKey) => void; onOpen: (stock: Stock) => void; onToggleSave: (ticker: string) => void }) {
  const ranked = sortRecommendations(getRecommendations(universe.filter((stock) => tickers.includes(stock.ticker)), priorities), sort)
  return <><section className="simple-hero"><span className="eyebrow"><Bookmark size={14}/> Saved research</span><h1>Your watchlist.</h1><p>Keep the companies worth another look in one focused view.</p></section><StockTable ranked={ranked} watchlist={tickers} sort={sort} onSort={onSort} onOpen={onOpen} onToggleSave={onToggleSave}/></>
}
