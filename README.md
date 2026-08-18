# Signal stock screener

A polished equity research workspace for screening companies, ranking ideas, and reviewing a transparent 1–100 scorecard.

## Connect the full U.S. stock market

The app integrates with Business Quant's free full-market screener. It covers U.S.-listed stocks across NYSE, Nasdaq, and OTC markets and supplies the fundamental metrics used by this app.

1. Create a free account and API key at [Business Quant](https://businessquant.com).
2. Create your local environment file:

```bash
cp .env.example .env
```

3. Open `.env` and add the key:

```text
BUSINESS_QUANT_API_KEY=your_actual_key_here
```

The key is read only by the local API server and is never shipped to the browser. `.env` is ignored by Git and must not be committed.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`. The app loads the full universe, caches it for 15 minutes, and renders 50 ranked companies per page. If the provider is temporarily unavailable, the server uses its last valid market snapshot when one exists. Without a key or cached snapshot, the app shows an unavailable state and never substitutes demo prices.

## Included

- Multi-factor screener for revenue, earnings, free cash flow growth, margins, valuation, market cap, sector, and insider activity
- User-selectable scoring priorities that change every stock's 1–100 rating
- Ranked results with market metrics, trend sparklines, and watchlist actions
- Curated investment-idea themes with rated recommendations and concise rationales
- Detailed company scorecards with growth, quality, valuation, and momentum breakdowns
- Full U.S. equity universe with client-side filtering and 50-row pagination
- Responsive desktop and mobile layouts

## Data note

The live universe and fundamentals come from Business Quant's SEC-derived screener API. The local dataset in `src/data/stocks.ts` is retained for tests and development fixtures only; it is never presented as live fallback data. Business Quant quote history powers table sparklines and the selectable price charts. Ranked table prices, changes, and scores stay on one screener snapshot so global sorting remains internally consistent.

## Validation

```bash
npm test
npm run test:coverage
npm run build
```
