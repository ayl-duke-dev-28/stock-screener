# Signal stock screener

A polished equity research workspace for screening companies, ranking ideas, and reviewing a transparent 1–100 scorecard.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Included

- Multi-factor screener for revenue, earnings, free cash flow growth, margins, valuation, market cap, sector, and insider activity
- User-selectable scoring priorities that change every stock's 1–100 rating
- Ranked results with market metrics, trend sparklines, and watchlist actions
- Curated investment-idea themes with rated recommendations and concise rationales
- Detailed company scorecards with growth, quality, valuation, and momentum breakdowns
- Responsive desktop and mobile layouts

## Data note

This first product version uses a clearly labeled sample dataset in `src/data/stocks.ts`. The scoring and filtering logic is isolated in `src/lib/screener.ts`, ready to connect to a licensed fundamentals and market-data API in a later iteration.

## Validation

```bash
npm test
npm run test:coverage
npm run build
```
