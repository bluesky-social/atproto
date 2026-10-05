import { afterEach, describe, expect, it, vi } from 'vitest'
import { ServerConfig } from './config.js'

const baseEnv: Record<string, string | undefined> = {
  BSKY_BSYNC_URL: 'http://localhost:2585',
  BSKY_DATAPLANE_URLS: 'http://localhost:4000',
  BSKY_DATAPLANE_URLS_ETCD_KEY_PREFIX: undefined,
  BSKY_ETCD_HOSTS: undefined,
  BSKY_DATAPLANE_HTTP_VERSION: '2',
  BSKY_BLOB_RATE_LIMIT_BYPASS_KEY: undefined,
  BSKY_BLOB_RATE_LIMIT_BYPASS_HOSTNAME: undefined,
  BSKY_INDEXED_AT_EPOCH: undefined,
  BSKY_KWS_API_KEY: undefined,
  BSKY_KWS_API_ORIGIN: undefined,
  BSKY_KWS_AUTH_ORIGIN: undefined,
  BSKY_KWS_CLIENT_ID: undefined,
  BSKY_KWS_REDIRECT_URL: undefined,
  BSKY_KWS_USER_AGENT: undefined,
  BSKY_KWS_VERIFICATION_SECRET: undefined,
  BSKY_KWS_WEBHOOK_SECRET: undefined,
  BSKY_KWS_AGE_VERIFIED_WEBHOOK_SECRET: undefined,
  BSKY_KWS_AGE_VERIFIED_REDIRECT_SECRET: undefined,
  BSKY_SEEMORE_SERVICE_DID: undefined,
  BSKY_IRIS_STAGING_SERVICE_DID: undefined,
  BSKY_FEEDGEN_DIDS: undefined,
  MOD_SERVICE_DID: 'did:example:moderation',
}

function readConfig(env: Record<string, string | undefined> = {}) {
  for (const [name, value] of Object.entries({ ...baseEnv, ...env })) {
    vi.stubEnv(name, value)
  }
  return ServerConfig.readEnv()
}

afterEach(() => vi.unstubAllEnvs())

describe('ServerConfig feed generator environment config', () => {
  it('defaults optional DIDs and feed generator DIDs when unset', () => {
    const config = readConfig()

    expect(config.seemoreServiceDid).toBeUndefined()
    expect(config.irisStagingServiceDid).toBeUndefined()
    expect(config.bskyFeedgenDids).toEqual(new Set())
  })

  it('treats empty optional DIDs and feed generator DIDs as unset', () => {
    const config = readConfig({
      BSKY_SEEMORE_SERVICE_DID: '',
      BSKY_IRIS_STAGING_SERVICE_DID: '',
      BSKY_FEEDGEN_DIDS: '',
    })

    expect(config.seemoreServiceDid).toBeUndefined()
    expect(config.irisStagingServiceDid).toBeUndefined()
    expect(config.bskyFeedgenDids).toEqual(new Set())
  })

  it('reads and validates the optional DIDs and deduplicates feed generator DIDs', () => {
    const config = readConfig({
      BSKY_SEEMORE_SERVICE_DID: 'did:example:seemore',
      BSKY_IRIS_STAGING_SERVICE_DID: 'did:example:iris-staging',
      BSKY_FEEDGEN_DIDS:
        'did:example:iris,did:example:trending,did:example:iris,did:example:seemore',
    })

    expect(config.seemoreServiceDid).toBe('did:example:seemore')
    expect(config.irisStagingServiceDid).toBe('did:example:iris-staging')
    expect(config.bskyFeedgenDids).toEqual(
      new Set([
        'did:example:iris',
        'did:example:trending',
        'did:example:seemore',
      ]),
    )
  })

  it.each(['BSKY_SEEMORE_SERVICE_DID', 'BSKY_IRIS_STAGING_SERVICE_DID'])(
    'validates %s as a DID',
    (name) => {
      expect(() => readConfig({ [name]: 'not-a-did' })).toThrow()
    },
  )
})
