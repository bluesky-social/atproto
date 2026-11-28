import { afterEach, describe, expect, it, vi } from 'vitest'
import { type ServerEnvironment, envToCfg, readEnv } from './index.js'

describe('spaces migration config', () => {
  const baseEnv: ServerEnvironment = { blobstoreDiskLocation: '/tmp/blobs' }

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to enabled', () => {
    expect(envToCfg(baseEnv).spacesMigration.state).toBe('enabled')
  })

  it.each(['disabled', 'enabled', 'complete'] as const)(
    'accepts %s',
    (state) => {
      const cfg = envToCfg({ ...baseEnv, spacesMigration: state })
      expect(cfg.spacesMigration.state).toBe(state)
    },
  )

  it('refuses an unknown state rather than guess', () => {
    expect(() => envToCfg({ ...baseEnv, spacesMigration: 'done' })).toThrow(
      /PDS_SPACES_MIGRATION/,
    )
  })

  it('is read from PDS_SPACES_MIGRATION', () => {
    vi.stubEnv('PDS_SPACES_MIGRATION', 'complete')
    expect(readEnv().spacesMigration).toBe('complete')
  })
})

describe('appview request limit config', () => {
  const baseEnv: ServerEnvironment = {
    blobstoreDiskLocation: '/tmp/blobs',
    bskyAppViewUrl: 'https://appview.invalid',
    bskyAppViewDid: 'did:example:appview',
  }

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to no limits, with 1500 queued and a 5000 ms queue wait when enabled.', () => {
    const cfg = envToCfg(baseEnv)
    expect(cfg.bskyAppView).toMatchObject({
      maxRequestsPerSecond: 0,
      maxConcurrentRequests: 0,
      maxQueuedRequests: 1500,
      maxQueueMs: 5000,
    })
  })

  it('takes the limits from the environment, keeping 0 as 0.', () => {
    vi.stubEnv('PDS_BSKY_APP_VIEW_MAX_REQUESTS_PER_SECOND', '50')
    vi.stubEnv('PDS_BSKY_APP_VIEW_MAX_CONCURRENT_REQUESTS', '20')
    vi.stubEnv('PDS_BSKY_APP_VIEW_MAX_QUEUED_REQUESTS', '10')
    vi.stubEnv('PDS_BSKY_APP_VIEW_MAX_QUEUE_MS', '2000')
    expect(envToCfg({ ...readEnv(), ...baseEnv }).bskyAppView).toMatchObject({
      maxRequestsPerSecond: 50,
      maxConcurrentRequests: 20,
      maxQueuedRequests: 10,
      maxQueueMs: 2000,
    })

    // 0 means "no limit" for the rate and the concurrency cap and "never
    // wait" for the queue wait, so it must not fall back to the default.
    vi.stubEnv('PDS_BSKY_APP_VIEW_MAX_REQUESTS_PER_SECOND', '0')
    vi.stubEnv('PDS_BSKY_APP_VIEW_MAX_CONCURRENT_REQUESTS', '0')
    vi.stubEnv('PDS_BSKY_APP_VIEW_MAX_QUEUE_MS', '0')
    expect(envToCfg({ ...readEnv(), ...baseEnv }).bskyAppView).toMatchObject({
      maxRequestsPerSecond: 0,
      maxConcurrentRequests: 0,
      maxQueuedRequests: 10,
      maxQueueMs: 0,
    })
  })

  it.each([
    [
      'bskyAppViewMaxRequestsPerSecond',
      'PDS_BSKY_APP_VIEW_MAX_REQUESTS_PER_SECOND',
    ],
    [
      'bskyAppViewMaxConcurrentRequests',
      'PDS_BSKY_APP_VIEW_MAX_CONCURRENT_REQUESTS',
    ],
    ['bskyAppViewMaxQueuedRequests', 'PDS_BSKY_APP_VIEW_MAX_QUEUED_REQUESTS'],
    ['bskyAppViewMaxQueueMs', 'PDS_BSKY_APP_VIEW_MAX_QUEUE_MS'],
  ] as const)('rejects a negative %s, naming %s.', (key, name) => {
    expect(() => envToCfg({ ...baseEnv, [key]: -1 })).toThrow(name)
  })
})

describe('entryway api url config', () => {
  const ENTRYWAY_URL = 'https://entryway.invalid'
  const baseEnv: ServerEnvironment = {
    blobstoreDiskLocation: '/tmp/blobs',
    entrywayUrl: ENTRYWAY_URL,
    entrywayDid: 'did:example:entryway',
    entrywayJwtVerifyKeyK256PublicKeyHex: 'abcd',
    entrywayPlcRotationKey: 'did:key:example',
  }

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to the entryway url.', () => {
    const cfg = envToCfg(baseEnv)
    expect(cfg.entryway?.url).toBe(ENTRYWAY_URL)
    expect(cfg.entryway?.apiUrl).toBe(ENTRYWAY_URL)
  })

  it('leaves the entryway url public when set.', () => {
    const cfg = envToCfg({
      ...baseEnv,
      entrywayApiUrl: 'http://127.0.0.1:8443',
    })
    expect(cfg.entryway?.apiUrl).toBe('http://127.0.0.1:8443')
    expect(cfg.entryway?.url).toBe(ENTRYWAY_URL)
    expect(cfg.oauth.issuer).toBe(ENTRYWAY_URL)
  })

  it('is read from PDS_ENTRYWAY_API_URL.', () => {
    vi.stubEnv('PDS_ENTRYWAY_API_URL', 'http://127.0.0.1:8443')
    expect(readEnv().entrywayApiUrl).toBe('http://127.0.0.1:8443')
    vi.stubEnv('PDS_ENTRYWAY_API_URL', '')
    expect(readEnv().entrywayApiUrl).toBeUndefined()
  })
})

describe('trusted proxies config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is read from PDS_TRUSTED_PROXIES', () => {
    vi.stubEnv('PDS_TRUSTED_PROXIES', 'loopback, 172.16.0.0/16')
    expect(readEnv().trustedProxies).toEqual(['loopback', '172.16.0.0/16'])
    vi.stubEnv('PDS_TRUSTED_PROXIES', '')
    expect(readEnv().trustedProxies).toBeUndefined()
  })
})
