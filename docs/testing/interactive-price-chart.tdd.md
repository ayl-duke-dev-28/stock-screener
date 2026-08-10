# Interactive price chart: TDD evidence

## Source and user journeys

No plan file was supplied. The journeys were derived from the request:

1. As an analyst, I want to switch between 1D, 1M, 6M, 1Y, and 5Y price history so I can review performance at different horizons.
2. As an analyst, I want to hover over the chart and see the price at that point so I can inspect the series precisely.
3. As an analyst, I want separate Price and 1D Performance columns so I can read and sort both values independently.

## Task report

### RED

- Command: `npm test -- --run server/businessQuant.test.ts src/App.test.tsx`
- Result: 4 intended failures.
- Evidence: quote requests remained hard-coded to `mode=daily&period=1y`; the 1D Performance heading did not exist; and the detail chart lacked the 1D control and interactive price chart.
- Checkpoint: `ac6d785 test: reproduce interactive chart and performance gaps`

### GREEN

- Command: `npm test -- --run server/businessQuant.test.ts src/App.test.tsx`
- Result: 2 files and 17 tests passed.
- Evidence: 1D maps to minute bars, 5Y maps to the full daily horizon, dated price history is returned, five range buttons render and switch data, hover exposes the selected price, and Price/1D Performance are separate sortable headings.
- Checkpoint: `cffdba9 feat: add interactive multi-range price charts`

## Test specification

| # | What is guaranteed | Test target | Type | Result |
|---|--------------------|-------------|------|--------|
| 1 | 1D requests use one-minute intraday bars and return chronological dated price points | `server/businessQuant.test.ts: requests intraday bars for 1D charts` | Adapter unit | PASS |
| 2 | 5Y requests use daily data with enough capacity for the complete horizon | `server/businessQuant.test.ts: requests the full selected daily chart horizon` | Adapter unit | PASS |
| 3 | The table exposes independent sortable Price and 1D Performance headings | `src/App.test.tsx: sorts every data column` | Component integration | PASS |
| 4 | The detail view exposes 1D, 1M, 6M, 1Y, and 5Y controls and fetches the selected range | `src/App.test.tsx: switches chart ranges` | Component integration | PASS |
| 5 | Hovering the chart displays the nearest point price | `src/App.test.tsx: reveals the hovered point price` | Component interaction | PASS |

## Full verification and coverage

- `npm test`: 5 files and 28 tests passed.
- `npm run test:coverage`: 92.61% statements, 82.09% branches, 97.5% functions, and 96.66% lines.
- `npm run build`: TypeScript and Vite production build passed.
- Live verification: the cached AAPL 1Y request returned 251 dated points. Additional uncached range checks hit Business Quant's 120-request daily key limit after the session's data audits; official range support and generated requests are covered by the adapter tests.
- Known gap: no browser E2E framework is configured. Critical interactions are covered in rendered React Testing Library tests.

