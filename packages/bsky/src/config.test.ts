import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ServerConfig } from './config.js'

// `ServerConfig.readEnv` asserts on unrelated required settings before it reads
// the proxy caps, so the test needs a minimally complete environment.
const REQUIRED_ENV = {
  BSKY_DATAPLANE_URLS: 'http://127.0.0.1:1',
  BSKY_BSYNC_URL: 'http://127.0.0.1:2',
  MOD_SERVICE_DID: 'did:web:example.com',
}
const CAP_ENV = [
  'BSKY_PROXY_POOL_CONNECTIONS',
  'BSKY_PROXY_MAX_ORIGINS',
] as const

const saved = new Map<string, string | undefined>()

beforeAll(() => {
  for (const [name, value] of [
    ...Object.entries(REQUIRED_ENV),
    ...CAP_ENV.map((name) => [name, undefined] as const),
  ]) {
    saved.set(name, process.env[name])
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

afterEach(() => {
  for (const name of CAP_ENV) delete process.env[name]
})

afterAll(() => {
  for (const [name, value] of saved) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

describe('blob dispatcher cap configuration', () => {
  it('leaves both caps unset by default', () => {
    const cfg = ServerConfig.readEnv()
    expect(cfg.proxyPoolConnections).toBeUndefined()
    expect(cfg.proxyMaxOrigins).toBeUndefined()
  })

  it('treats empty values as unset', () => {
    process.env.BSKY_PROXY_POOL_CONNECTIONS = ''
    process.env.BSKY_PROXY_MAX_ORIGINS = ''
    const cfg = ServerConfig.readEnv()
    expect(cfg.proxyPoolConnections).toBeUndefined()
    expect(cfg.proxyMaxOrigins).toBeUndefined()
  })

  it('reads positive decimal integers', () => {
    process.env.BSKY_PROXY_POOL_CONNECTIONS = '4'
    process.env.BSKY_PROXY_MAX_ORIGINS = '250'
    const cfg = ServerConfig.readEnv()
    expect(cfg.proxyPoolConnections).toBe(4)
    expect(cfg.proxyMaxOrigins).toBe(250)
  })

  it.each([
    '0',
    '-1',
    '1.5',
    ' 4',
    '4 ',
    '1e3',
    '0x10',
    '+4',
    '00',
    '004',
    'four',
    '99999999999999999999',
  ])('rejects %j', (value) => {
    for (const name of CAP_ENV) {
      process.env[name] = value
      expect(() => ServerConfig.readEnv()).toThrow(name)
      delete process.env[name]
    }
  })
})
