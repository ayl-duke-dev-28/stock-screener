import { describe, expect, it } from 'vitest'
import { mapProviderStock } from './businessQuant'

describe('provider sector normalization', () => {
  // Regression: ISSUE-006 — empty provider sectors created an unlabeled filter option
  // Found by /qa on 2026-08-12
  // Report: .gstack/qa-reports/qa-report-localhost-2026-08-12.md
  it('maps blank and whitespace-only sectors to Unclassified', () => {
    expect(mapProviderStock({ ticker: 'BLANK', sector: '' }, {}).sector).toBe('Unclassified')
    expect(mapProviderStock({ ticker: 'SPACE', sector: '   ' }, {}).sector).toBe('Unclassified')
  })
})
