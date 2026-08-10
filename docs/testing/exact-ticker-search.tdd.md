# Exact ticker search: TDD evidence

## Source and user journey

No plan file was supplied. The journey was derived from the request:

> As an analyst, I want the search field to accept only a complete ticker symbol, so partial symbols and company names do not produce ambiguous matches.

## Task report

- RED command: `npm test -- src/lib/screener.test.ts`
- RED result: 1 failed test because `GRO` incorrectly matched ticker `GROW`.
- GREEN command: `npm test -- src/lib/screener.test.ts`
- GREEN result: all 7 screener tests passed.
- RED checkpoint: `bb7cd12`.
- GREEN checkpoint: `ffe272c`.

## Test specification

| # | What is guaranteed | Test target | Type | Result |
|---|--------------------|-------------|------|--------|
| 1 | A complete ticker matches regardless of letter case | `src/lib/screener.test.ts: matches only complete ticker symbols` | Unit | PASS |
| 2 | Leading and trailing spaces around a ticker are ignored | `src/lib/screener.test.ts: matches only complete ticker symbols` | Unit | PASS |
| 3 | A partial ticker does not match | `src/lib/screener.test.ts: matches only complete ticker symbols` | Unit | PASS |
| 4 | A company name does not match | `src/lib/screener.test.ts: matches only complete ticker symbols` | Unit | PASS |

## Full verification and coverage

- `npm test`: 5 files and 22 tests passed.
- `npm run test:coverage`: 94.77% statements, 82.30% branches, 97.43% functions, and 99.06% lines.
- `npm run build`: TypeScript and Vite production build passed.
- Known gap: no browser E2E framework is configured; exact-match behavior is covered at the pure filtering boundary.
