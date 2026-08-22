# Screener improvements: TDD evidence

This pass used behavior-first regression tests for each material correctness or workflow change. Tests were committed while failing, then product code was committed only after the focused and full suites passed.

| Behavior locked down | RED commit | GREEN commit |
| --- | --- | --- |
| Provider outlier rejection, score coverage, broad search | `bf04ce2` | `8453e4e` |
| Compact quote payloads, compression, cache/security headers, path containment | `6185a81` | `f3047e3` |
| Loading/retry states and schema-safe preference persistence | `fdb5452` | `58b51b9` |
| Separate accessible row actions, visible sort direction, removable criteria, CSV export | `02ccd4e` | `93f13fe` |
| Methodology disclosure, ranked-result coverage, chart control/error accessibility | `c5f8851` | `8b3f7d0` |
| Cached snapshot timestamp | `0730f8f` | `04186c1` |
| Partial-data rating qualification | `e735845` | `cb125e9` |
| Watchlist and Ideas empty-state recovery | `fc1e46c` | `02fab47` |

## Final verification

```text
Test files: 16 passed
Tests: 63 passed
Statements: 86%+
Branches: 80%+
Functions: 84%+
Lines: 94%+
Production build: passed
High-severity dependency audit: 0 vulnerabilities
```

Coverage includes `src/App.tsx`, all production modules under `src/lib`, and the provider, market-data, and HTTP response modules under `server`. Fixtures, tests, test setup, and the browser entry point are excluded.
