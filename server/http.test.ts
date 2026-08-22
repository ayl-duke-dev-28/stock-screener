import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { compactQuotes, encodeJson, resolvePublicFile, responseHeaders } from './http'

describe('HTTP response helpers', () => {
  it('compresses large JSON only when the client accepts gzip', () => {
    const payload = { stocks: Array.from({ length: 200 }, (_, index) => ({ ticker: `T${index}`, name: 'Repeated company name' })) }
    const plain = encodeJson(payload, '')
    const compressed = encodeJson(payload, 'br, gzip')

    expect(plain.encoding).toBeUndefined()
    expect(compressed.encoding).toBe('gzip')
    expect(compressed.body.byteLength).toBeLessThan(plain.body.byteLength)
    expect(JSON.parse(gunzipSync(compressed.body).toString('utf8'))).toEqual(payload)
  })

  it('sets security and cache headers for API, HTML, and hashed assets', () => {
    expect(responseHeaders('api')).toEqual(expect.objectContaining({
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      'Content-Security-Policy': expect.stringContaining("default-src 'self'"),
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    }))
    expect(responseHeaders('html')['Cache-Control']).toBe('no-cache')
    expect(responseHeaders('asset')['Cache-Control']).toBe('public, max-age=31536000, immutable')
  })

  it('keeps static files inside the build directory', () => {
    expect(resolvePublicFile('/app/dist', '/assets/app-ABC123.js')).toBe('/app/dist/assets/app-ABC123.js')
    expect(resolvePublicFile('/app/dist', '/../dist-malicious/secret.txt')).toBeNull()
  })

  it('removes full history from quote summaries without mutating cached quotes', () => {
    const quotes = [{ ticker: 'AAPL', price: 200, change: 1, sparkline: [190, 200], history: [{ date: '2026-01-01', price: 190 }] }]
    const summary = compactQuotes(quotes)

    expect(summary).toEqual([{ ticker: 'AAPL', price: 200, change: 1, sparkline: [190, 200] }])
    expect(quotes[0].history).toHaveLength(1)
  })
})
