import { relative, resolve, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import type { StockQuote } from './businessQuant'

type ResponseKind = 'api' | 'error' | 'html' | 'asset'

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; connect-src 'self'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
} as const

export function responseHeaders(kind: ResponseKind): Record<string, string> {
  const cacheControl = kind === 'api'
    ? 'public, max-age=60, stale-while-revalidate=300'
    : kind === 'asset'
      ? 'public, max-age=31536000, immutable'
      : kind === 'html'
        ? 'no-cache'
        : 'no-store'
  return { ...securityHeaders, 'Cache-Control': cacheControl }
}

export function encodeJson(payload: unknown, acceptEncoding: string | undefined) {
  const plain = Buffer.from(JSON.stringify(payload))
  if (plain.byteLength >= 1024 && /(?:^|,)\s*gzip\s*(?:,|$)/i.test(acceptEncoding ?? '')) {
    return { body: gzipSync(plain), encoding: 'gzip' as const }
  }
  return { body: plain, encoding: undefined }
}

export function resolvePublicFile(distRoot: string, pathname: string) {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const filePath = resolve(distRoot, requested)
  const pathFromRoot = relative(distRoot, filePath)
  if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`)) return null
  return filePath
}

export function compactQuotes(quotes: StockQuote[]) {
  return quotes.map(({ history: _history, ...quote }) => quote)
}
