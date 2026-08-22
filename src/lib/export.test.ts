import { describe, expect, it } from 'vitest'
import { stocks } from '../data/stocks'
import { buildResultsCsv } from './export'

describe('results export', () => {
  it('exports ranked values with a header and safely quotes company names', () => {
    const csv = buildResultsCsv([{ stock: { ...stocks[0], name: 'Example, Inc.' }, score: 88 }])

    expect(csv.split('\n')[0]).toBe('Rank,Ticker,Company,Sector,Signal score,Price,1D change %,Market cap $B,Revenue growth %,Earnings growth %,FCF growth %,Gross margin %,P/E,P/S')
    expect(csv).toContain('1,NVDA,"Example, Inc.",Technology,88')
  })
})
