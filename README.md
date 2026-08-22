# Signal stock screener

Signal is a responsive equity-research workspace for filtering the U.S. stock universe, ranking companies with a transparent 1–100 heuristic, reviewing company scorecards, and keeping a local watchlist.

It is a research aid, not investment advice or a backtested prediction model.

## What it includes

- Ticker-prefix and company-name search, sector and market-cap filters, and six numeric factor filters
- User-selected score priorities, visible factor coverage, and explicit data-confidence treatment
- Sortable, paginated 25-row results with compact quote summaries and CSV export
- Company price charts across 1 day, 1 month, 6 months, 1 year, and 5 years
- Fundamental scorecards, explainable idea themes, and an honest empty watchlist
- Local persistence for watchlist, filters, priorities, and sort order
- Loading, retry, stale-cache, empty-data, and missing-chart states
- Responsive and keyboard-accessible controls with mobile data-freshness status

## Requirements

- Node.js 24.15 or newer in the Node 24 release line
- npm and a Business Quant API key

## Set up locally

1. Install the exact locked dependencies:

   ```bash
   npm ci
   ```

2. Create a free Business Quant account and API key at [businessquant.com](https://businessquant.com).

3. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

4. Add the server-side key to `.env`:

   ```text
   BUSINESS_QUANT_API_KEY=your_actual_key_here
   ```

5. Start the API and web development servers:

   ```bash
   npm run dev
   ```

Open `http://localhost:5173`. The key is read only by the Node API server and is never bundled into browser code. `.env` is ignored by Git and must not be committed.

## Architecture

```text
Browser (React + Vite)
  ├─ GET /api/stocks                     ranked-universe snapshot
  └─ GET /api/quotes?tickers=...         compact table quotes or chart history
             │
Node HTTP server
  ├─ validates requests and normalizes provider data
  ├─ coalesces matching in-flight requests
  ├─ caches market snapshots and range-specific quotes
  ├─ serves compressed JSON and hardened static assets
  └─ calls Business Quant with bounded timeouts
```

The provider universe is cached for 15 minutes. Quote caches are isolated by range and response detail. If a refresh fails after a valid snapshot has been captured, the API can return that snapshot with `stale: true` and its original `updatedAt` timestamp. The UI labels cached data explicitly. It never substitutes fixture prices for live data.

The fixture universe in `src/data/stocks.ts` is used by automated tests only.

## Scoring methodology

The default base score combines four category scores:

- Growth: 34%
- Quality: 26%
- Valuation: 25%
- Momentum: 15%

Revenue, earnings, free-cash-flow growth, and gross margin are mapped to bounded 0–100 factor scores. Valuation multiples score inversely. Momentum uses current price change and insider activity only when that data exists. If priorities are selected, their available factor scores are averaged and blended 55% priority / 45% base.

Missing priority factors are excluded rather than treated as zero. A category with no available inputs uses a neutral 50 baseline, and final scores are capped according to selected-factor coverage (`40 + coverage × 60`). Every ranked row exposes the reported/selected factor count; detail pages label high, medium, or low confidence.

Provider validation rejects unusable identity fields, non-positive prices and market caps, non-finite numbers, and physically impossible gross margins above 100%. Missing values remain `N/A` and do not silently become zero.

This score has not been validated against point-in-time historical fundamentals, benchmark returns, survivorship-bias controls, or transaction costs. Do not interpret it as expected return, risk, or a recommendation to trade.

## API behavior

- `GET /api/stocks` returns the normalized universe, source, stale flag, and snapshot timestamp.
- `GET /api/quotes?tickers=AAPL,MSFT&range=1m&detail=summary` returns current price, change, and compact sparklines without full history.
- Omitting `detail=summary` returns range history for company charts.
- API responses use short shared-cache headers and gzip when accepted.
- Hashed production assets are immutable; HTML is served with `no-cache`.
- Errors are structured and safe for display; provider credentials and response bodies are not exposed.

## Local data and privacy

Signal has no accounts, analytics, or cloud persistence. Watchlist and screener preferences are stored in browser `localStorage` under a versioned key and remain on that browser profile. CSV export is generated locally. Clearing site data removes saved preferences.

External requests go to the configured market-data provider through the local server. Google Fonts are currently loaded by the browser from `fonts.googleapis.com`; self-host them if the deployment requires a no-third-party-request policy.

## Validation

Run the full local gate:

```bash
npm run check
```

That command runs unit and interaction tests, coverage with 80% statement/branch/function/line thresholds, TypeScript compilation, and the production build. Individual commands remain available:

```bash
npm test
npm run test:coverage
npm run build
npm audit --audit-level=high
```

GitHub Actions repeats install, high-severity dependency audit, tests, coverage, and build on pushes to `main` and pull requests.

## Production deployment

1. Run `npm ci` and `npm run build` on Node 24.15+.
2. Set `BUSINESS_QUANT_API_KEY` in the host's secret manager, not in the client build environment.
3. Set `PORT` if the platform does not inject one.
4. Start the service with `npm start`; the Node server serves `dist/` and the API from one origin.
5. Terminate TLS at the platform or reverse proxy and preserve `Accept-Encoding` so compressed API responses remain available.
6. Monitor structured request timing logs and provider failures. The process closes cleanly on `SIGINT` and `SIGTERM`.

## Known product boundaries

Accounts, cross-device watchlists, alerts, analyst estimates, earnings calendars, real insider-transaction screening, portfolio connections, and shared saved screens need additional services or provider entitlements. Controls and themes do not claim those capabilities today.

Before positioning Signal as an investment product, add historical point-in-time data, factor and portfolio backtests, benchmark comparisons, corporate-action handling, survivorship-bias controls, and appropriate legal/compliance review.
