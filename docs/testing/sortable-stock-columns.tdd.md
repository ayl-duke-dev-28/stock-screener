# Sortable stock columns: TDD evidence

## Source and user journey

No plan file was supplied. The journey was derived from the request:

> As an analyst, I want to click any stock-table column heading and alternate between descending and ascending order, so I can compare companies by the metric I am reviewing.

## Task report

### Sortable table headings

- RED command: `npm test -- src/App.test.tsx`
- RED result: 1 failed test because no accessible `Sort by Company` button existed.
- GREEN command: `npm test -- src/App.test.tsx`
- GREEN result: 3 tests passed, including all eight sortable headings and both revenue-growth directions.
- Checkpoints: `40c56d1` (RED test) and `38e33c5` (GREEN implementation).

### Full-universe price sorting

- RED command: `npm test -- server/businessQuant.test.ts`
- RED result: 2 failures because the provider's current `Price` screener metric was unresolved and mapped to zero.
- GREEN command: `npm test -- server/businessQuant.test.ts`
- GREEN result: 8 tests passed; screener prices now populate the universe before client-side sorting.
- Checkpoints: `354c917` (RED test) and `1027916` (GREEN implementation).

## Test specification

| # | What is guaranteed | Test target | Type | Result |
|---|--------------------|-------------|------|--------|
| 1 | Company, price, market cap, revenue growth, FCF growth, gross margin, P/E, and signal headings are clickable controls | `src/App.test.tsx: sorts every data column` | Component integration | PASS |
| 2 | The first revenue-growth click sorts largest to smallest | `src/App.test.tsx: sorts every data column` | Component integration | PASS |
| 3 | A second click on the same heading reverses the order | `src/App.test.tsx: sorts every data column` | Component integration | PASS |
| 4 | The active heading exposes its current direction and displays an arrow | `src/App.test.tsx: sorts every data column` | Accessibility/UI | PASS |
| 5 | Price sorting uses the provider's full-universe screener price rather than unquoted zero placeholders | `server/businessQuant.test.ts: resolves provider metric names` | Adapter unit | PASS |

## Full verification and coverage

- `npm test`: 5 files and 21 tests passed.
- `npm run test:coverage`: 94.77% statements, 82.45% branches, 97.43% functions, and 99.06% lines.
- `npm run build`: TypeScript and Vite production build passed.
- Known gap: no browser E2E framework is configured; the interaction is covered through React Testing Library in the rendered application.
