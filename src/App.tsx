import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Bell,
  Bookmark, BookmarkCheck, Check, ChevronDown, CircleHelp, Filter, Lightbulb,
  ListFilter, Search, SlidersHorizontal, Sparkles, TrendingUp, X,
} from 'lucide-react'
import { stocks as sampleStocks } from './data/stocks'
import { filterStocks, getRecommendations, scoreStock, scoreToLabel } from './lib/screener'
import { paginate } from './lib/pagination'
import type { Filters, MetricKey, ScoreBreakdown, Stock } from './types'

const defaultFilters: Filters = {
  search: '', sector: 'All sectors', marketCap: 'all', minRevenueGrowth: 0,
  minEarningsGrowth: 0, minFcfGrowth: 0, minGrossMargin: 0,
  maxPe: 80, maxPs: 30, insiderOnly: false,
}

type NumericFilterKey = 'minRevenueGrowth' | 'minEarningsGrowth' | 'minFcfGrowth' | 'minGrossMargin' | 'maxPe' | 'maxPs'
type Quote = Pick<Stock, 'ticker' | 'price' | 'change' | 'sparkline'>

const numericFilterKeys = new Set<keyof Filters>([
  'minRevenueGrowth', 'minEarningsGrowth', 'minFcfGrowth', 'minGrossMargin', 'maxPe', 'maxPs',
])

const metricOptions: { key: MetricKey; label: string }[] = [
  { key: 'revenueGrowth', label: 'Revenue growth' },
  { key: 'earningsGrowth', label: 'Earnings growth' },
  { key: 'fcfGrowth', label: 'Free cash flow' },
  { key: 'grossMargin', label: 'Gross margin' },
  { key: 'pe', label: 'P/E' },
  { key: 'ps', label: 'P/S' },
  { key: 'insiderActivity', label: 'Insider activity' },
]

const scoreColor = (score: number) => score >= 75 ? '#16856b' : score >= 55 ? '#c0841a' : '#a45b52'
const formatMarketCap = (value: number) => value >= 1000 ? `$${(value / 1000).toFixed(2)}T` : `$${value.toFixed(0)}B`

function Sparkline({ values, positive = true, large = false }: { values: number[]; positive?: boolean; large?: boolean }) {
  const width = large ? 640 : 92
  const height = large ? 190 : 34
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((value, index) => `${(index / (values.length - 1)) * width},${height - ((value - min) / range) * (height - 8) - 4}`).join(' ')
  return (
    <svg className={large ? 'hero-chart' : 'sparkline'} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Price trend">
      {large && <><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#16856b" stopOpacity=".22"/><stop offset="1" stopColor="#16856b" stopOpacity="0"/></linearGradient></defs><polygon points={`0,${height} ${points} ${width},${height}`} fill="url(#chartFill)" /></>}
      <polyline points={points} fill="none" stroke={positive ? '#16856b' : '#b45f55'} strokeWidth={large ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />
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
  const metrics = [
    ['Revenue growth', `${stock.revenueGrowth.toFixed(1)}%`, stock.revenueGrowth > 15],
    ['Earnings growth', `${stock.earningsGrowth.toFixed(1)}%`, stock.earningsGrowth > 15],
    ['Free cash flow growth', `${stock.fcfGrowth.toFixed(1)}%`, stock.fcfGrowth > 15],
    ['Gross margin', `${stock.grossMargin.toFixed(1)}%`, stock.grossMargin > 50],
    ['P/E ratio', `${stock.pe.toFixed(1)}×`, stock.pe < 30],
    ['P/S ratio', `${stock.ps.toFixed(1)}×`, stock.ps < 8],
  ]
  return <main className="detail-page">
    <button className="back-button" onClick={onBack}><ArrowLeft size={16}/> Back to screener</button>
    <section className="detail-header">
      <div className="company-heading"><div className="company-logo large-logo">{stock.ticker.slice(0, 1)}</div><div><div className="eyebrow">{stock.sector} · NASDAQ</div><h1>{stock.name} <span>{stock.ticker}</span></h1><div className="detail-price">${stock.price.toFixed(2)} <span className={stock.change >= 0 ? 'positive' : 'negative'}>{stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%</span></div></div></div>
      <button className={`save-button ${isSaved ? 'saved' : ''}`} onClick={onToggleSave}>{isSaved ? <BookmarkCheck size={17}/> : <Bookmark size={17}/>} {isSaved ? 'Saved' : 'Add to watchlist'}</button>
    </section>
    <section className="detail-grid">
      <div className="chart-card card"><div className="card-heading"><div><span className="eyebrow">Price performance</span><h2>12 month trajectory</h2></div><div className="range-tabs"><button>1M</button><button>6M</button><button className="active">1Y</button><button>5Y</button></div></div><Sparkline values={stock.sparkline} positive={stock.change >= 0} large/></div>
      <div className="rating-card card"><span className="eyebrow">Signal rating</span><div className="rating-main"><ScoreBadge score={result.score} size="large"/><div><h2>{scoreToLabel(result.score)}</h2><p>Based on {priorities.length || 7} selected criteria</p></div></div><BreakdownBars breakdown={result.breakdown}/></div>
    </section>
    <section className="analysis-grid">
      <div className="card metric-card"><div className="card-heading"><div><span className="eyebrow">Fundamentals</span><h2>Scorecard</h2></div><span className="live-dot"><i/> Latest reported</span></div><div className="metric-list">{metrics.map(([label, value, good]) => <div key={String(label)}><span>{label}</span><strong>{value}</strong><em className={good ? 'metric-good' : 'metric-neutral'}>{good ? 'Above benchmark' : 'Within range'}</em></div>)}</div></div>
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
  const [sort, setSort] = useState<'score' | 'marketCap' | 'revenueGrowth'>('score')
  const [marketStocks, setMarketStocks] = useState<Stock[]>(sampleStocks)
  const [dataSource, setDataSource] = useState<'loading' | 'live' | 'sample'>('loading')
  const [sourceLabel, setSourceLabel] = useState('Connecting…')
  const [page, setPage] = useState(1)
  const [activeNumericFilters, setActiveNumericFilters] = useState<Set<NumericFilterKey>>(new Set())
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const requestedQuotes = useRef(new Set<string>())

  useEffect(() => {
    let active = true
    fetch('/api/stocks')
      .then(async (response) => {
        if (!response.ok) throw new Error('Market API unavailable')
        return response.json() as Promise<{ stocks: Stock[]; source: string }>
      })
      .then((payload) => {
        if (!active || !payload.stocks?.length) return
        setMarketStocks(payload.stocks)
        setSourceLabel(payload.source)
        setDataSource('live')
      })
      .catch(() => {
        if (!active) return
        setSourceLabel('Sample fallback')
        setDataSource('sample')
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
    if (sort === 'marketCap') return [...recommendations].sort((a, b) => b.stock.marketCap - a.stock.marketCap)
    if (sort === 'revenueGrowth') return [...recommendations].sort((a, b) => b.stock.revenueGrowth - a.stock.revenueGrowth)
    return recommendations
  }, [filtered, priorities, sort])
  const pagedResults = useMemo(() => paginate(ranked, page, 50), [ranked, page])
  useEffect(() => setPage(1), [filters, priorities, sort])
  const activeFilterCount = activeNumericFilters.size + [filters.sector !== defaultFilters.sector, filters.marketCap !== defaultFilters.marketCap, filters.insiderOnly].filter(Boolean).length

  const quoteTargets = useMemo(() => {
    if (dataSource !== 'live') return []
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
  const togglePriority = (key: MetricKey) => setPriorities((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  const toggleWatchlist = (ticker: string) => setWatchlist((current) => current.includes(ticker) ? current.filter((item) => item !== ticker) : [...current, ticker])

  if (selectedStock) return <div className="app-shell"><TopBar view={view} setView={(next) => { setView(next); setSelectedStock(null) }}/><StockDetail stock={withQuote(selectedStock)} priorities={priorities} isSaved={watchlist.includes(selectedStock.ticker)} onBack={() => setSelectedStock(null)} onToggleSave={() => toggleWatchlist(selectedStock.ticker)}/></div>

  return <div className="app-shell">
    <TopBar view={view} setView={setView}/>
    <main className="dashboard">
      {view === 'screener' && <>
        <section className="page-title"><div><span className="eyebrow">Equity research workspace</span><h1>Find signal in the market.</h1><p>Screen the universe, rank what matters, and investigate the strongest ideas.</p></div><div className={`as-of ${dataSource}`}><span><i/> {dataSource === 'live' ? 'Full US universe' : 'Market data'}</span><strong>{sourceLabel}</strong><small>{dataSource === 'loading' ? 'Loading listed equities' : dataSource === 'live' ? `${marketStocks.length.toLocaleString()} companies loaded` : 'Add an API key for full coverage'}</small></div></section>
        <section className="toolbar card"><div className="search-box"><Search size={18}/><input aria-label="Search companies" placeholder="Search by company or ticker" value={filters.search} onChange={(event) => patchFilter('search', event.target.value)}/><kbd>⌘ K</kbd></div><button className={`filter-button ${filterOpen ? 'active' : ''}`} onClick={() => setFilterOpen(!filterOpen)}><SlidersHorizontal size={17}/> Filters {activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button><div className="toolbar-divider"/><span className="result-count"><strong>{ranked.length}</strong> companies</span></section>
        {filterOpen && <section className="filter-panel card">
          <div className="filter-panel-head"><div><ListFilter size={17}/><strong>Refine universe</strong></div><button onClick={resetFilters}>Reset all</button></div>
          <div className="filter-grid"><label className="select-field"><span>Sector</span><div><select value={filters.sector} onChange={(event) => patchFilter('sector', event.target.value)}>{availableSectors.map((sector) => <option key={sector}>{sector}</option>)}</select><ChevronDown size={14}/></div></label><label className="select-field"><span>Market cap</span><div><select value={filters.marketCap} onChange={(event) => patchFilter('marketCap', event.target.value as Filters['marketCap'])}><option value="all">Any size</option><option value="mega">Mega cap ($200B+)</option><option value="large">Large cap ($10–200B)</option><option value="mid">Mid cap ($2–10B)</option><option value="small">Small cap (&lt;$2B)</option></select><ChevronDown size={14}/></div></label><SliderField label="Min. revenue growth" value={filters.minRevenueGrowth} min={-10} max={60} step={1} suffix="%" onChange={(value) => patchFilter('minRevenueGrowth', value)}/><SliderField label="Min. earnings growth" value={filters.minEarningsGrowth} min={-20} max={80} step={1} suffix="%" onChange={(value) => patchFilter('minEarningsGrowth', value)}/><SliderField label="Min. FCF growth" value={filters.minFcfGrowth} min={-20} max={60} step={1} suffix="%" onChange={(value) => patchFilter('minFcfGrowth', value)}/><SliderField label="Min. gross margin" value={filters.minGrossMargin} min={0} max={90} step={1} suffix="%" onChange={(value) => patchFilter('minGrossMargin', value)}/><SliderField label="Max. P/E ratio" value={filters.maxPe} min={5} max={80} step={1} suffix="×" onChange={(value) => patchFilter('maxPe', value)}/><SliderField label="Max. P/S ratio" value={filters.maxPs} min={1} max={30} step={1} suffix="×" onChange={(value) => patchFilter('maxPs', value)}/></div>
          <div className="priority-row"><div><span>Score priorities</span><small>Ratings adapt to what matters to you</small></div><div className="priority-chips">{metricOptions.map(({ key, label }) => <button className={priorities.includes(key) ? 'selected' : ''} onClick={() => togglePriority(key)} key={key}>{priorities.includes(key) && <Check size={12}/>} {label}</button>)}</div><label className="toggle"><input type="checkbox" checked={filters.insiderOnly} onChange={(event) => patchFilter('insiderOnly', event.target.checked)}/><span/><em>Insider buying only</em></label></div>
        </section>}
        <section className="results-header"><div><h2>Ranked companies</h2><p>Scored against your selected priorities</p></div><label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="score">Signal score</option><option value="marketCap">Market cap</option><option value="revenueGrowth">Revenue growth</option></select></label></section>
        <StockTable ranked={displayedPage} watchlist={watchlist} onOpen={setSelectedStock} onToggleSave={toggleWatchlist}/>
        {ranked.length > 0 && <Pagination page={pagedResults.page} pageCount={pagedResults.pageCount} total={pagedResults.total} onPage={setPage}/>} 
      </>}
      {view === 'ideas' && <Ideas universe={quotedUniverse} priorities={priorities} onOpen={setSelectedStock}/>}
      {view === 'watchlist' && <Watchlist universe={quotedUniverse} tickers={watchlist} priorities={priorities} onOpen={setSelectedStock} onToggleSave={toggleWatchlist}/>}
    </main>
  </div>
}

function Pagination({ page, pageCount, total, onPage }: { page: number; pageCount: number; total: number; onPage: (page: number) => void }) {
  return <nav className="pagination" aria-label="Stock results pagination"><span>Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total.toLocaleString()}</span><div><button aria-label="Previous page" disabled={page === 1} onClick={() => onPage(page - 1)}><ArrowLeft size={15}/></button><strong>Page {page} of {pageCount}</strong><button aria-label="Next page" disabled={page === pageCount} onClick={() => onPage(page + 1)}><ArrowRight size={15}/></button></div></nav>
}

function TopBar({ view, setView }: { view: string; setView: (view: 'screener' | 'ideas' | 'watchlist') => void }) {
  return <header className="topbar"><button className="brand" onClick={() => setView('screener')}><span><TrendingUp/></span>SIGNAL</button><nav><button className={view === 'screener' ? 'active' : ''} onClick={() => setView('screener')}>Screener</button><button className={view === 'ideas' ? 'active' : ''} onClick={() => setView('ideas')}>Ideas <small>NEW</small></button><button className={view === 'watchlist' ? 'active' : ''} onClick={() => setView('watchlist')}>Watchlist</button></nav><div className="top-actions"><button aria-label="Notifications"><Bell size={18}/><i/></button><div className="avatar">AL</div></div></header>
}

function StockTable({ ranked, watchlist, onOpen, onToggleSave }: { ranked: ReturnType<typeof getRecommendations>; watchlist: string[]; onOpen: (stock: Stock) => void; onToggleSave: (ticker: string) => void }) {
  if (!ranked.length) return <div className="empty card"><Filter size={28}/><h3>No companies match this screen</h3><p>Try widening one or two filters to bring more of the market back into view.</p></div>
  return <section className="table-card card"><div className="stock-table table-head"><span>Company</span><span>Price / trend</span><span>Market cap</span><span>Revenue</span><span>FCF growth</span><span>Gross margin</span><span>P/E</span><span>Signal</span><span/></div>{ranked.map(({ stock, score }) => <button className="stock-table table-row" key={stock.ticker} onClick={() => onOpen(stock)}><span className="company-cell"><i className="company-logo">{stock.ticker[0]}</i><span><strong>{stock.ticker}</strong><small>{stock.name}</small></span></span><span className="price-cell"><span><strong>${stock.price.toFixed(2)}</strong><small className={stock.change >= 0 ? 'positive' : 'negative'}>{stock.change >= 0 ? <ArrowUpRight/> : <ArrowDownRight/>}{Math.abs(stock.change).toFixed(2)}%</small></span><Sparkline values={stock.sparkline} positive={stock.change >= 0}/></span><span>{formatMarketCap(stock.marketCap)}</span><span className={stock.revenueGrowth >= 15 ? 'metric-good' : ''}>{stock.revenueGrowth.toFixed(1)}%</span><span className={stock.fcfGrowth >= 15 ? 'metric-good' : ''}>{stock.fcfGrowth.toFixed(1)}%</span><span>{stock.grossMargin.toFixed(1)}%</span><span>{stock.pe.toFixed(1)}×</span><span className="signal-cell"><ScoreBadge score={score}/><span><strong>{scoreToLabel(score)}</strong><small>of 100</small></span></span><span className="row-actions"><i onClick={(event) => { event.stopPropagation(); onToggleSave(stock.ticker) }}>{watchlist.includes(stock.ticker) ? <BookmarkCheck/> : <Bookmark/>}</i><ArrowRight/></span></button>)}</section>
}

function Ideas({ universe, priorities, onOpen }: { universe: Stock[]; priorities: MetricKey[]; onOpen: (stock: Stock) => void }) {
  const themes = [
    { title: 'Profitable compounders', tag: 'Quality growth', copy: 'Strong top-line growth, expanding cash generation, and durable margins.', color: 'sage', picks: getRecommendations(universe.filter((s) => s.revenueGrowth > 15 && s.fcfGrowth > 18), ['revenueGrowth', 'fcfGrowth', 'grossMargin']).slice(0, 3) },
    { title: 'Growth at a fair price', tag: 'GARP', copy: 'Above-market earnings growth without the most demanding valuation multiples.', color: 'sand', picks: getRecommendations(universe.filter((s) => s.earningsGrowth > 20 && s.pe < 35), ['earningsGrowth', 'pe', 'ps']).slice(0, 3) },
    { title: 'Insiders leaning in', tag: 'Smart money', copy: 'Positive insider activity paired with improving fundamental momentum.', color: 'blue', picks: getRecommendations(universe.filter((s) => s.insiderActivity > 3), ['insiderActivity', 'earningsGrowth']).slice(0, 3) },
  ]
  const top = getRecommendations(universe, priorities)[0]
  return <><section className="ideas-hero"><div><span className="eyebrow"><Sparkles size={14}/> Signal ideas</span><h1>A sharper place to start.</h1><p>Curated research themes built from fundamental signals—not hype.</p></div><div className="idea-feature card"><span>Highest conviction today</span><div><div className="company-logo">{top.stock.ticker[0]}</div><div><strong>{top.stock.ticker}</strong><small>{top.stock.name}</small></div><ScoreBadge score={top.score}/><button onClick={() => onOpen(top.stock)}>View thesis <ArrowRight/></button></div></div></section><section className="theme-grid">{themes.map((theme) => <article className={`theme-card card ${theme.color}`} key={theme.title}><span className="theme-tag">{theme.tag}</span><h2>{theme.title}</h2><p>{theme.copy}</p><div className="theme-picks">{theme.picks.map((pick) => <button key={pick.stock.ticker} onClick={() => onOpen(pick.stock)}><span><i className="company-logo">{pick.stock.ticker[0]}</i><span><strong>{pick.stock.ticker}</strong><small>{pick.reason}</small></span></span><span><ScoreBadge score={pick.score}/><ArrowRight/></span></button>)}</div></article>)}</section></>
}

function Watchlist({ universe, tickers, priorities, onOpen, onToggleSave }: { universe: Stock[]; tickers: string[]; priorities: MetricKey[]; onOpen: (stock: Stock) => void; onToggleSave: (ticker: string) => void }) {
  const ranked = getRecommendations(universe.filter((stock) => tickers.includes(stock.ticker)), priorities)
  return <><section className="simple-hero"><span className="eyebrow"><Bookmark size={14}/> Saved research</span><h1>Your watchlist.</h1><p>Keep the companies worth another look in one focused view.</p></section><StockTable ranked={ranked} watchlist={tickers} onOpen={onOpen} onToggleSave={onToggleSave}/></>
}
