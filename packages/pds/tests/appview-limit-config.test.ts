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

  it('defaults to 300 requests per second, 100 in flight and 1500 queued.', () => {
    const cfg = envToCfg(baseEnv)
    expect(cfg.bskyAppView).toMatchObject({
      maxRequestsPerSecond: 300,
      maxConcurrentRequests: 100,
      maxQueuedRequests: 1500,
    })
  })

  it('takes the limits from the environment, keeping 0 as 0.', () => {
    const names = [
      'PDS_BSKY_APP_VIEW_MAX_REQUESTS_PER_SECOND',
      'PDS_BSKY_APP_VIEW_MAX_CONCURRENT_REQUESTS',
      'PDS_BSKY_APP_VIEW_MAX_QUEUED_REQUESTS',
    ]
    const prev = names.map((name) => process.env[name])
    try {
      process.env.PDS_BSKY_APP_VIEW_MAX_REQUESTS_PER_SECOND = '50'
      process.env.PDS_BSKY_APP_VIEW_MAX_CONCURRENT_REQUESTS = '20'
      process.env.PDS_BSKY_APP_VIEW_MAX_QUEUED_REQUESTS = '10'
      expect(envToCfg({ ...readEnv(), ...baseEnv }).bskyAppView).toMatchObject({
        maxRequestsPerSecond: 50,
        maxConcurrentRequests: 20,
        maxQueuedRequests: 10,
      })

      // 0 means "no limit" for the rate and the concurrency cap, so it must
      // not fall back to the default.
      process.env.PDS_BSKY_APP_VIEW_MAX_REQUESTS_PER_SECOND = '0'
      process.env.PDS_BSKY_APP_VIEW_MAX_CONCURRENT_REQUESTS = '0'
      expect(envToCfg({ ...readEnv(), ...baseEnv }).bskyAppView).toMatchObject({
        maxRequestsPerSecond: 0,
        maxConcurrentRequests: 0,
        maxQueuedRequests: 10,
      })
    } finally {
      names.forEach((name, i) => {
        const value = prev[i]
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
      })
    }
  })
})
