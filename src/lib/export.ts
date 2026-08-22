import type { Stock } from '../types'

const headers = ['Rank', 'Ticker', 'Company', 'Sector', 'Signal score', 'Price', '1D change %', 'Market cap $B', 'Revenue growth %', 'Earnings growth %', 'FCF growth %', 'Gross margin %', 'P/E', 'P/S']
const csvValue = (value: string | number | null) => {
  if (value === null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function buildResultsCsv(results: Array<{ stock: Stock; score: number }>) {
  const rows = results.map(({ stock, score }, index) => [
    index + 1, stock.ticker, stock.name, stock.sector, score, stock.price, stock.change,
    stock.marketCap, stock.revenueGrowth, stock.earningsGrowth, stock.fcfGrowth,
    stock.grossMargin, stock.pe, stock.ps,
  ])
  return [headers, ...rows].map((row) => row.map(csvValue).join(',')).join('\n')
}

export function downloadResultsCsv(results: Array<{ stock: Stock; score: number }>) {
  const url = URL.createObjectURL(new Blob([buildResultsCsv(results)], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `signal-screen-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}
