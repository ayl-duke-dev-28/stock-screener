# Data consistency and cache fixes TDD evidence

## Source

The user requested implementation of the bugs found during the 2026-08-18 repository audit. No external plan file was used.

## User journeys

- As an analyst, I want missing provider values to remain missing so screens and scores never treat absent fundamentals as real zeroes.
- As an operator, I want provider outages to respect a cooldown even without a cache so traffic cannot repeatedly exhaust the API allowance.
- As an analyst, I want overlapping quote requests to share one provider call and temporarily missing quotes to retry later.
- As an analyst, I want the prices shown in ranked results to match the snapshot used for global sorting and scoring.
- As an analyst, I want an empty market response to leave the loading state and show a clear unavailable state.

## RED / GREEN report

| Behavior | RED evidence | GREEN evidence | Checkpoints |
|---|---|---|---|
| Blank provider metrics remain missing | `npm test -- server/businessQuant.test.ts` failed because blank, `%`, and `$,` values mapped to `0` | The same command passed 15/15 tests | RED `07f2614`; GREEN `87c2b9f` |
| Cold-start cooldown, quote coalescing, and negative caching | `npm test -- server/marketData.test.ts` failed because `./marketData` did not exist | `npm test -- server/marketData.test.ts server/businessQuant.test.ts` passed 18/18 tests | RED `c2509ee`; GREEN `37e7c6c` |
| Empty-market handling, consistent ranked prices, and bounded quote retries | `npm test -- src/lib/quoteRequests.test.ts src/App.test.tsx` failed on the missing tracker, indefinite loading, and mismatched displayed prices | Targeted UI and tracker regression run passed 11/11 tests | RED `f2a2391`; GREEN `04fb83e` |
| Provider coordination is included in coverage | `npm test -- server/viteConfig.test.ts` failed because `server/marketData.ts` was absent from the coverage include list | The same command passed 3/3 tests | RED `8bd5f09`; GREEN `642ab99` |

## Test specification

| # | What is guaranteed | Test target | Type | Result |
|---|---|---|---|---|
| 1 | Formatting-only provider metrics map to `null`, not zero | `businessQuant.test.ts: treats blank and formatting-only provider metrics as missing instead of zero` | Unit | PASS |
| 2 | A failed cold-start refresh is attempted once per cooldown window | `marketData.test.ts: does not retry a failed cold-start market refresh until the cooldown expires` | Unit | PASS |
| 3 | Concurrent requests for the same quote share one provider promise | `marketData.test.ts: coalesces overlapping quote requests for the same ticker and range` | Concurrency unit | PASS |
| 4 | Missing quotes are briefly negative-cached server-side | `marketData.test.ts: briefly negative-caches missing quotes instead of repeatedly hitting the provider` | Unit | PASS |
| 5 | Missing browser quotes become eligible for a bounded retry | `quoteRequests.test.ts: releases missing quotes for a bounded retry instead of suppressing them forever` | Unit | PASS |
| 6 | An empty market response exits loading and shows the unavailable state | `App.test.tsx: leaves the loading state when the market API returns an empty universe` | UI integration | PASS |
| 7 | Ranked table prices match the snapshot used for global sorting | `App.test.tsx: keeps displayed table prices consistent with the snapshot used for global sorting` | UI integration | PASS |
| 8 | Coverage measures the extracted provider coordination logic | `viteConfig.test.ts: measures the provider coordination code in coverage runs` | Configuration | PASS |

## Final verification

- `npm test`: 13 test files passed; 45 tests passed.
- `npm run test:coverage`: 90.11% statements, 84.21% branches, 91.78% functions, and 93.89% lines.
- `npm run build`: TypeScript and Vite production build passed; 1,797 modules transformed.

## Known gaps

- `server/index.ts` remains a thin HTTP transport entry point and is not imported by coverage because importing it starts a listening socket. The retry, cache, and request-coalescing behavior now lives in the covered `server/marketData.ts` module.
- JSDOM logs its expected `window.scrollTo()` not-implemented notice during UI tests; the regression suite stubs and verifies scroll behavior where relevant.
