import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { ServerConfig } from './config.js'

describe('HTTP access log configuration', () => {
  beforeEach(() => {
    vi.stubEnv('BSKY_DATAPLANE_URLS', 'http://localhost:3001')
    vi.stubEnv('BSKY_BSYNC_URL', 'http://localhost:3002')
    vi.stubEnv('MOD_SERVICE_DID', 'did:example:moderation')
    vi.stubEnv('BSKY_HTTP_LOG_SUCCESS_SAMPLE_RATE', undefined)
    vi.stubEnv('BSKY_HTTP_LOG_SLOW_REQUEST_MS', undefined)
  })
  afterEach(() => vi.unstubAllEnvs())

  it('retains all successful access logs by default', () => {
    const config = ServerConfig.readEnv()
    expect(config.httpLogSuccessSampleRate).toBe(1)
    expect(config.httpLogSlowRequestMs).toBe(1000)
  })

  it('reads a sampling rate and slow-request duration from the environment', () => {
    vi.stubEnv('BSKY_HTTP_LOG_SUCCESS_SAMPLE_RATE', '0.1')
    vi.stubEnv('BSKY_HTTP_LOG_SLOW_REQUEST_MS', '2000')
    const config = ServerConfig.readEnv()
    expect(config.httpLogSuccessSampleRate).toBe(0.1)
    expect(config.httpLogSlowRequestMs).toBe(2000)
  })

  test.each(['0', '1'])('accepts sampling boundary %s', (rate) => {
    vi.stubEnv('BSKY_HTTP_LOG_SUCCESS_SAMPLE_RATE', rate)
    expect(ServerConfig.readEnv().httpLogSuccessSampleRate).toBe(Number(rate))
  })

  test.each(['', ' ', 'NaN', 'Infinity', '-0.1', '1.1', '0.1suffix'])(
    'rejects invalid sampling rate %j',
    (rate) => {
      vi.stubEnv('BSKY_HTTP_LOG_SUCCESS_SAMPLE_RATE', rate)
      expect(() => ServerConfig.readEnv()).toThrow(
        'BSKY_HTTP_LOG_SUCCESS_SAMPLE_RATE',
      )
    },
  )

  test.each(['', ' ', 'NaN', 'Infinity', '-1', '1000ms'])(
    'rejects invalid slow-request duration %j',
    (duration) => {
      vi.stubEnv('BSKY_HTTP_LOG_SLOW_REQUEST_MS', duration)
      expect(() => ServerConfig.readEnv()).toThrow(
        'BSKY_HTTP_LOG_SLOW_REQUEST_MS',
      )
    },
  )

  it('validates programmatic overrides as well as environment values', () => {
    expect(() =>
      ServerConfig.readEnv({ httpLogSuccessSampleRate: NaN }),
    ).toThrow('BSKY_HTTP_LOG_SUCCESS_SAMPLE_RATE')
    expect(() => ServerConfig.readEnv({ httpLogSlowRequestMs: -1 })).toThrow(
      'BSKY_HTTP_LOG_SLOW_REQUEST_MS',
    )
  })
})
