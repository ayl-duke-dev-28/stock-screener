# Chart hover alignment and price axis: TDD evidence

## Source and user journeys

No plan file was supplied. The journeys were derived from the request:

1. As an analyst, I want the hovered price point to stay directly under my cursor across the full chart width.
2. As an analyst, I want a labeled dollar Y-axis so I can understand the chart's price scale without hovering.

## Task report

### RED

- Command: `npm test -- --run src/App.test.tsx`
- Result: 1 intended failure.
- Evidence: a simulated letterboxed SVG selected `$100.00` when the cursor mapped to the `$90.00` point, and the chart had no price-axis group.
- Checkpoint: `04d40e9 test: reproduce chart hover drift and missing price axis`

### GREEN

- Command: `npm test -- --run src/App.test.tsx`
- Result: 1 file and 5 tests passed.
- Evidence: pointer coordinates are transformed from screen space into the SVG viewBox before selecting the nearest point, and five Y-axis price labels render from the series maximum to minimum.
- Checkpoint: `cfcd489 fix: align chart hover and add price axis`

## Test specification

| # | What is guaranteed | Test target | Type | Result |
|---|--------------------|-------------|------|--------|
| 1 | Centered SVG padding does not shift the selected hover point | `src/App.test.tsx: switches chart ranges and reveals the hovered point price` | Component interaction | PASS |
| 2 | The tooltip displays the price belonging to the nearest transformed chart coordinate | Same test | Component interaction | PASS |
| 3 | Every populated detail chart renders five dollar-denominated Y-axis labels | Same test | Component rendering | PASS |
| 4 | The Y-axis spans the visible series maximum and minimum | Same test | Boundary rendering | PASS |

## Full verification and coverage

- `npm test`: 5 files and 28 tests passed.
- `npm run test:coverage`: 92.61% statements, 82.09% branches, 97.5% functions, and 96.66% lines.
- `npm run build`: TypeScript and Vite production build passed.
- Known gap: no browser E2E framework is configured. The offset is reproduced with browser-equivalent SVG transformation and bounding-box geometry in React Testing Library.

