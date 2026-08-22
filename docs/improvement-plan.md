# Signal screener improvement plan

This backlog is the implementation contract for the August 2026 audit. Every checked item must be shipped, tested, and committed. Items that require a new paid data source, user accounts, or deployment infrastructure are documented as product limits rather than represented as working features.

## Audit baseline

- [x] `npm test`: 45 tests pass.
- [x] `npm run build`: succeeds; client bundle is 225.51 kB (70.84 kB gzip).
- [x] `npm run test:coverage`: 90.11% statements, 84.21% branches, 93.89% lines for the currently included service and library files.
- [x] `npm audit`: zero known vulnerabilities.
- [x] Browser QA at 375 px, 768 px, and 1280 px with live provider data.
- [x] Network audit: `/api/stocks` is about 2 MB uncompressed and the first 50-stock quote response is about 559 kB because it includes full history the table never renders.

## P0: correctness and investor trust

- [x] Reject physically impossible percentage metrics from the provider instead of presenting and rewarding them. Gross margin above 100% is the observed production example.
- [x] Attach score coverage to every result and explain how many selected factors actually contributed.
- [x] Keep incomplete companies from receiving an unqualified top-tier label; distinguish score strength from data confidence.
- [x] Replace exact-ticker-only lookup with forgiving ticker-prefix and company-name search while preserving exact-ticker priority.
- [x] Make empty searches, unavailable market data, missing chart history, and unconnected themes explicit. Never imply data exists when it does not.
- [x] Show the provider snapshot timestamp and clearly distinguish fresh from stale cached data.
- [x] Document the score formula, factor limits, missing-data treatment, source, update cadence, and non-advice limitations in-product and in the README.

## P0: API performance and resilience

- [x] Use short-range quote data for table sparklines and omit full history from summary responses.
- [x] Reduce the default table page from 50 rows so mobile pages and quote batches stay useful and fast.
- [x] Compress large JSON responses when the client accepts gzip.
- [x] Apply correct cache policy: short shared caching for API snapshots, immutable caching for hashed assets, and no-cache for HTML.
- [x] Add provider request timeouts so a stalled upstream cannot hold requests indefinitely.
- [x] Preserve request coalescing and negative caching while keeping range-specific quote caches isolated.
- [x] Add safe, actionable API errors without leaking provider credentials or upstream response bodies.
- [x] Harden static path containment and add baseline security headers.
- [x] Add graceful server error handling and structured request timing logs.

## P1: core screener workflow

- [x] Add an explicit retry action for a failed initial market load.
- [x] Render a dedicated loading state instead of a misleading empty-results state.
- [x] Persist watchlist, active filters, score priorities, and sort choice locally with schema-safe parsing.
- [x] Start new users with an honest empty watchlist instead of fabricated saved tickers.
- [x] Collapse advanced filters by default on narrow screens and preserve the user’s choice during the session.
- [x] Surface active criteria as removable filter chips and keep “Reset all” behavior obvious.
- [x] Add an accessible sort-direction control for layouts where table headers are hidden.
- [x] Add CSV export for the complete currently filtered and ranked result set.
- [x] Give watchlist and ideas their own useful empty states and recovery actions.
- [x] Do not render an “insider” idea collection when the current feed has no insider data.

## P1: accessibility and responsive usability

- [x] Replace the inaccessible bookmark `<i>` click target inside each row with a named button.
- [x] Ensure opening a company and toggling its watchlist state are separate keyboard actions.
- [x] Expose selected states with `aria-pressed`, expanded states with `aria-expanded`, and current navigation with `aria-current`.
- [x] Expose sort state programmatically and keep visible direction indicators.
- [x] Give the price chart a useful accessible summary and keyboard-readable range controls; announce loading and error states.
- [x] Add visible `:focus-visible` treatment across controls.
- [x] Respect reduced-motion preferences and maintain touch targets near 44 px on mobile navigation and primary actions.
- [x] Keep the data-source status visible on mobile instead of hiding the only freshness signal.
- [x] Prevent the mobile results page from becoming a 50-row wall and retain the most decision-useful columns.
- [x] Make notification and unavailable-feature controls honest, labeled, and non-blocking.

## P1: maintainability, tests, and delivery

- [x] Extract reusable formatting, persistence, and API-response logic from the large app component where it reduces duplicated behavior.
- [x] Add regression tests for provider outliers, score coverage, broad search, persisted preferences, retry, compact quote payloads, response headers, and accessible row actions.
- [x] Include application UI code in coverage reporting so the headline percentage is not limited to libraries and server adapters.
- [x] Stub unsupported DOM APIs in test setup so passing runs are quiet and failures are visible.
- [x] Add a single `npm run check` command covering tests, coverage, and production build.
- [x] Pin package manifest versions instead of using `latest`, retain the lockfile, and declare the supported Node version.
- [x] Add CI for install, audit, tests, coverage, and build.
- [x] Expand README setup, architecture, validation, data-quality, privacy, and deployment notes.
- [x] Re-run desktop, tablet, and mobile browser QA; verify console/network state and the main screener, detail, ideas, watchlist, retry, filtering, sorting, pagination, and export flows.

## Explicit product limits

- Accounts, cloud-synced watchlists, alerts, real insider transactions, analyst estimates, earnings calendars, saved screens shared across devices, and portfolio integration need new services or provider entitlements. This pass removes misleading placeholders and documents these boundaries; it does not invent data or an identity system.
- The score remains a transparent research heuristic, not a backtested prediction model. A production investment product should add point-in-time fundamentals, survivorship-bias controls, benchmarked factor research, and historical validation before claiming predictive power.

## Completion evidence

- Final gate: 63 tests pass, full-project coverage clears all 80% thresholds, production build succeeds, and `npm audit --audit-level=high` reports zero vulnerabilities.
- Final live QA covered 375 px, 768 px, and 1280 px layouts plus search, filtering, sorting, pagination, CSV export, detail charts, ideas, watchlist save/remove, empty-state recovery, console, and network behavior.
- The table quote batch is now a compact summary response (about 1.4 kB for the first 25 live rows in the final run); the compressed full-universe response is about 339 kB.
- RED/GREEN evidence is recorded in `docs/testing/screener-improvements.tdd.md`.
