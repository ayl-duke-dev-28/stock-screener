# Stock screener TDD evidence

## Source

User journeys were derived from the product request during this TDD run. No external plan file was used.

## User journeys

- As an analyst, I can filter companies across growth, cash flow, quality, valuation, size, sector, and insider activity so I can narrow the market quickly.
- As an analyst, I can choose the metrics that matter to me so each company's rating reflects my current research lens.
- As an investor looking for ideas, I can browse themed, rated recommendations and understand why each surfaced.
- As an analyst researching a company, I can open a detailed 1–100 scorecard and see the category breakdown behind it.

## RED / GREEN report

- RED command: `npm test`
- RED evidence: the suite failed to resolve `./screener`; the scoring and filtering implementation did not yet exist.
- GREEN command: `npm test`
- GREEN evidence: 1 test file passed and all 6 tests passed.
- Production build command: `npm run build`
- Build evidence: TypeScript and Vite completed successfully; 1,796 modules transformed.

## Test specification

| # | What is guaranteed | Test target | Type | Result |
|---|---|---|---|---|
| 1 | Scores stay between 1 and 100 and expose four category scores | `scoreStock: returns a bounded score and category breakdown` | Unit | PASS |
| 2 | Growth and value priorities change rankings in the expected direction | `scoreStock: changes weighting to match selected screening criteria` | Unit | PASS |
| 3 | Score bands have stable, readable labels | `scoreStock: maps score bands to readable labels` | Unit | PASS |
| 4 | All supported filters can be combined | `filterStocks: applies ... filters` | Unit | PASS |
| 5 | An unrestricted screen returns the full universe | `filterStocks: returns all stocks ...` | Unit | PASS |
| 6 | Recommendations are ranked, scored, and include a reason | `getRecommendations: ranks every result and includes a reason` | Unit | PASS |

## Coverage and browser QA

- Command: `npm run test:coverage`
- Statements: 91.48%
- Branches: 84.61%
- Functions: 100%
- Lines: 97.05%
- Browser checks: initial load, filter result update, ranked-row navigation, detailed scorecard, Ideas view, Watchlist view, desktop layout, and 390px mobile layout.
- Browser console: no application errors observed.

## Known gap

The current dataset is local sample data. Live prices, filings, and insider transactions require a licensed upstream data provider and server-side API credentials.

## Criteria slider update

- Journey: As an analyst, I can drag each numeric investment criterion and see its current threshold and matching results update immediately.
- RED command: `npm test -- src/App.test.tsx`
- RED evidence: the interaction test failed because no accessible controls with the `slider` role existed.
- GREEN command: `npm test -- src/App.test.tsx`
- GREEN evidence: the slider interaction test passed, including the live result-count update from 12 to 2 companies at 30% minimum revenue growth.
- Full regression: `npm test` passed 7/7 tests across 2 test files.
- Coverage after change: 91.48% statements, 88.46% branches, 100% functions, and 97.05% lines for the scoring/filtering engine.
- Build: `npm run build` completed successfully.
- Checkpoints: `7c678d1` preserves RED evidence; `abac4fb` preserves the GREEN implementation.

## Slider precision and readability update

- Journey: As an analyst, I can adjust every numeric criterion one unit at a time and read the supporting interface text comfortably.
- RED command: `npm test -- src/App.test.tsx`
- RED evidence: the test received `step="5"` for growth sliders while requiring `step="1"` for all six controls.
- GREEN command: `npm test -- src/App.test.tsx`
- GREEN evidence: all six slider controls expose `step="1"`, and the existing live-filter interaction remains green.
- Readability: filter labels, table data, helper text, score explanations, stock details, and idea cards received larger type sizes; primary supporting copy is now 16px.
- Full regression: `npm test` passed 7/7 tests; coverage remained at 91.48% statements and 97.05% lines; `npm run build` completed successfully.
- Checkpoints: `dd10bcb` preserves RED evidence; `a7d1dcb` preserves the GREEN implementation.
