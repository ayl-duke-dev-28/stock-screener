import { describe, expect, it } from 'vitest'
import { paginate } from './pagination'

describe('paginate', () => {
  it('renders a small page from a full-market result set', () => {
    const universe = Array.from({ length: 121 }, (_, index) => index + 1)
    expect(paginate(universe, 2, 50)).toEqual({
      items: universe.slice(50, 100), page: 2, pageCount: 3, total: 121,
    })
  })

  it('clamps a stale page after filters reduce the result count', () => {
    expect(paginate(['only result'], 9, 50)).toEqual({
      items: ['only result'], page: 1, pageCount: 1, total: 1,
    })
  })
})
