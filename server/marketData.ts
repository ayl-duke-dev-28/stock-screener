import type { MarketPayload, QuoteRange, StockQuote } from './businessQuant'

type FetchMarket = (apiKey: string) => Promise<MarketPayload>
type FetchQuotes = (apiKey: string, tickers: string[], range: QuoteRange) => Promise<StockQuote[]>

interface MarketDataCoordinatorOptions {
  fetchMarket: FetchMarket
  fetchQuotes: FetchQuotes
  cacheTtlMs?: number
  quoteMissTtlMs?: number
  now?: () => number
  onMarketRefresh?: (payload: MarketPayload) => Promise<void> | void
}

interface MarketResult {
  payload: MarketPayload
  stale: boolean
}

interface QuoteCacheEntry {
  expiresAt: number
  quote: StockQuote | null
}

export class ProviderRetryCooldownError extends Error {
  constructor() {
    super('Provider retry cooldown is active')
    this.name = 'ProviderRetryCooldownError'
  }
}

export class MarketDataCoordinator {
  private readonly fetchMarket: FetchMarket
  private readonly fetchQuotes: FetchQuotes
  private readonly cacheTtlMs: number
  private readonly quoteMissTtlMs: number
  private readonly now: () => number
  private readonly onMarketRefresh?: MarketDataCoordinatorOptions['onMarketRefresh']
  private marketCache: { expiresAt: number; payload: MarketPayload } | null = null
  private marketRefresh: Promise<MarketPayload> | null = null
  private marketRetryAt = 0
  private readonly quoteCache = new Map<string, QuoteCacheEntry>()
  private readonly quoteRefreshes = new Map<string, Promise<void>>()

  constructor(options: MarketDataCoordinatorOptions) {
    this.fetchMarket = options.fetchMarket
    this.fetchQuotes = options.fetchQuotes
    this.cacheTtlMs = options.cacheTtlMs ?? 15 * 60 * 1000
    this.quoteMissTtlMs = options.quoteMissTtlMs ?? 60 * 1000
    this.now = options.now ?? Date.now
    this.onMarketRefresh = options.onMarketRefresh
  }

  seedMarket(payload: MarketPayload) {
    if (!this.marketCache) this.marketCache = { payload, expiresAt: 0 }
  }

  getCachedMarket() {
    return this.marketCache?.payload ?? null
  }

  async getMarket(apiKey: string): Promise<MarketResult> {
    const now = this.now()
    if (this.marketCache && this.marketCache.expiresAt > now) {
      return { payload: this.marketCache.payload, stale: false }
    }
    if (this.marketRetryAt > now) {
      if (this.marketCache) return { payload: this.marketCache.payload, stale: true }
      throw new ProviderRetryCooldownError()
    }

    try {
      this.marketRefresh ??= this.fetchMarket(apiKey)
        .then(async (payload) => {
          this.marketCache = { payload, expiresAt: this.now() + this.cacheTtlMs }
          this.marketRetryAt = 0
          await this.onMarketRefresh?.(payload)
          return payload
        })
        .finally(() => { this.marketRefresh = null })
      return { payload: await this.marketRefresh, stale: false }
    } catch (error) {
      this.marketRetryAt = this.now() + this.cacheTtlMs
      if (this.marketCache) return { payload: this.marketCache.payload, stale: true }
      throw error
    }
  }

  async getQuotes(apiKey: string, tickers: string[], range: QuoteRange): Promise<StockQuote[]> {
    const uniqueTickers = Array.from(new Set(tickers))
    const key = (ticker: string) => `${range}:${ticker}`
    const now = this.now()
    const missing = uniqueTickers.filter((ticker) => {
      const cached = this.quoteCache.get(key(ticker))
      return (!cached || cached.expiresAt <= now) && !this.quoteRefreshes.has(key(ticker))
    })

    if (missing.length) {
      let refresh!: Promise<void>
      refresh = this.fetchQuotes(apiKey, missing, range)
        .then((quotes) => {
          const fetchedAt = this.now()
          const returned = new Map(quotes.map((quote) => [quote.ticker, quote]))
          missing.forEach((ticker) => {
            const quote = returned.get(ticker) ?? null
            this.quoteCache.set(key(ticker), {
              quote,
              expiresAt: fetchedAt + (quote ? this.cacheTtlMs : this.quoteMissTtlMs),
            })
          })
        })
        .finally(() => {
          missing.forEach((ticker) => {
            if (this.quoteRefreshes.get(key(ticker)) === refresh) this.quoteRefreshes.delete(key(ticker))
          })
        })
      missing.forEach((ticker) => this.quoteRefreshes.set(key(ticker), refresh))
    }

    await Promise.all(Array.from(new Set(uniqueTickers.flatMap((ticker) => {
      const refresh = this.quoteRefreshes.get(key(ticker))
      return refresh ? [refresh] : []
    }))))

    return uniqueTickers.flatMap((ticker) => this.quoteCache.get(key(ticker))?.quote ?? [])
  }
}
