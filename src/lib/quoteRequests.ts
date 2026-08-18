type TimerHandle = unknown

interface QuoteRequestTrackerOptions {
  onRetry: () => void
  schedule?: (callback: () => void, delayMs: number) => TimerHandle
  cancel?: (handle: TimerHandle) => void
  retryDelayMs?: number
}

export class QuoteRequestTracker {
  private readonly requested = new Set<string>()
  private readonly timers = new Set<TimerHandle>()
  private readonly onRetry: () => void
  private readonly schedule: NonNullable<QuoteRequestTrackerOptions['schedule']>
  private readonly cancel: NonNullable<QuoteRequestTrackerOptions['cancel']>
  private readonly retryDelayMs: number

  constructor(options: QuoteRequestTrackerOptions) {
    this.onRetry = options.onRetry
    this.schedule = options.schedule ?? ((callback, delayMs) => globalThis.setTimeout(callback, delayMs))
    this.cancel = options.cancel ?? ((handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>))
    this.retryDelayMs = options.retryDelayMs ?? 60_000
  }

  claim(tickers: string[], hasQuote: (ticker: string) => boolean, limit = 50) {
    const claimed: string[] = []
    for (const ticker of tickers) {
      if (claimed.length >= limit) break
      if (hasQuote(ticker) || this.requested.has(ticker)) continue
      this.requested.add(ticker)
      claimed.push(ticker)
    }
    return claimed
  }

  complete(attempted: string[], returned: string[]) {
    const returnedTickers = new Set(returned)
    const missing = attempted.filter((ticker) => !returnedTickers.has(ticker))
    if (!missing.length) return

    let timer: TimerHandle
    timer = this.schedule(() => {
      this.timers.delete(timer)
      missing.forEach((ticker) => this.requested.delete(ticker))
      this.onRetry()
    }, this.retryDelayMs)
    this.timers.add(timer)
  }

  fail(attempted: string[]) {
    attempted.forEach((ticker) => this.requested.delete(ticker))
  }

  dispose() {
    this.timers.forEach((timer) => this.cancel(timer))
    this.timers.clear()
  }
}
