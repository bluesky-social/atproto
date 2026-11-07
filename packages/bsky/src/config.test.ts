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
const REDIRECT_ENV = [
  'BSKY_BLOB_REDIRECT_ADMIN_PASSWORD',
  'BSKY_BLOB_REDIRECT_ADMIN_ORIGIN',
] as const

const saved = new Map<string, string | undefined>()

beforeAll(() => {
  for (const [name, value] of [
    ...Object.entries(REQUIRED_ENV),
    ...CAP_ENV.map((name) => [name, undefined] as const),
    ...REDIRECT_ENV.map((name) => [name, undefined] as const),
  ]) {
    saved.set(name, process.env[name])
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

afterEach(() => {
  for (const name of [...CAP_ENV, ...REDIRECT_ENV]) delete process.env[name]
})

afterAll(() => {
  for (const [name, value] of saved) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

describe('internal PDS blob redirect credentials', () => {
  it('does not send admin credentials by default', () => {
    const cfg = ServerConfig.readEnv()
    expect(cfg.blobRedirectAdminPassword).toBeUndefined()
    expect(cfg.blobRedirectAdminOrigin).toBeUndefined()
  })

  it('requires the password and scoped origin together', () => {
    process.env.BSKY_BLOB_REDIRECT_ADMIN_PASSWORD = 'synthetic-only'
    expect(() => ServerConfig.readEnv()).toThrow(
      'BSKY_BLOB_REDIRECT_ADMIN_ORIGIN',
    )
    delete process.env.BSKY_BLOB_REDIRECT_ADMIN_PASSWORD

    process.env.BSKY_BLOB_REDIRECT_ADMIN_ORIGIN = 'https://pds.test'
    expect(() => ServerConfig.readEnv()).toThrow(
      'BSKY_BLOB_REDIRECT_ADMIN_PASSWORD',
    )
  })

  it('applies the pair requirement to programmatic overrides too', () => {
    expect(() =>
      ServerConfig.readEnv({ blobRedirectAdminPassword: 'synthetic-only' }),
    ).toThrow('BSKY_BLOB_REDIRECT_ADMIN_ORIGIN')
    expect(() =>
      ServerConfig.readEnv({ blobRedirectAdminOrigin: 'https://pds.test' }),
    ).toThrow('BSKY_BLOB_REDIRECT_ADMIN_PASSWORD')
  })

  it('normalizes the exact HTTPS origin without widening it', () => {
    process.env.BSKY_BLOB_REDIRECT_ADMIN_PASSWORD = 'synthetic-only'
    process.env.BSKY_BLOB_REDIRECT_ADMIN_ORIGIN = ' HTTPS://PDS.TEST:443/ '
    const cfg = ServerConfig.readEnv()
    expect(cfg.blobRedirectAdminPassword).toBe('synthetic-only')
    expect(cfg.blobRedirectAdminOrigin).toBe('https://pds.test')
  })

  it('retains normalization for programmatic overrides', () => {
    const cfg = ServerConfig.readEnv({
      blobRedirectAdminPassword: 'synthetic-only',
      blobRedirectAdminOrigin: ' HTTPS://PDS.TEST:443/ ',
    })
    expect(cfg.blobRedirectAdminOrigin).toBe('https://pds.test')
  })

  it.each([
    'http://localhost:12345',
    'http://127.0.0.1:12345',
    'http://[::1]:12345',
  ])('allows an explicit loopback fixture origin: %s', (origin) => {
    process.env.BSKY_BLOB_REDIRECT_ADMIN_PASSWORD = 'synthetic-only'
    process.env.BSKY_BLOB_REDIRECT_ADMIN_ORIGIN = origin
    expect(ServerConfig.readEnv().blobRedirectAdminOrigin).toBe(origin)
  })

  it.each([
    '',
    'not-an-origin',
    'pds.test',
    'https://.pds.test',
    'https://pds.test:8443/path',
    'https://pds.test/?query=1',
    'https://pds.test/#fragment',
    'https://admin:pw@pds.test',
    'http://pds.test',
    'http://127.0.0.1.test',
    'https://pds.test:65536',
    'https://pds.test:0',
    'https://pds.test/other/..',
    'https://@pds.test',
    'https://pds.test/?',
    'https://pds.test/#',
    'https://pds.test\\',
    'https://bad..test',
    'https://-pds.test',
    'https://pds.test:',
    `https://${'a'.repeat(64)}.test`,
    `https://${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.test`,
    'https://pd\ts.test',
    'ftp://pds.test',
  ])('rejects invalid or unsafe origin %j', (origin) => {
    process.env.BSKY_BLOB_REDIRECT_ADMIN_PASSWORD = 'synthetic-only'
    process.env.BSKY_BLOB_REDIRECT_ADMIN_ORIGIN = origin
    expect(() => ServerConfig.readEnv()).toThrow(
      'BSKY_BLOB_REDIRECT_ADMIN_ORIGIN',
    )
  })
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
