import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type ServerEnvironment,
  envToCfg,
  readEnv,
} from '../src/config/index.js'

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
