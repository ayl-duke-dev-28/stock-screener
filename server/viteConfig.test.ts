import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import config from '../vite.config'

describe('development API routing', () => {
  it('proxies browser API requests to the market-data server', () => {
    expect(config.server?.proxy).toEqual({
      '/api': 'http://127.0.0.1:8787',
    })
  })

  it('starts Vite with the canonical TypeScript config', () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))
    expect(packageJson.scripts['dev:web']).toContain('--config vite.config.ts')
  })

  it('measures the provider coordination code in coverage runs', () => {
    expect(config.test?.coverage?.include).toEqual(expect.arrayContaining([
      'server/businessQuant.ts',
      'server/marketData.ts',
      'src/lib/**/*.ts',
    ]))
  })
})
