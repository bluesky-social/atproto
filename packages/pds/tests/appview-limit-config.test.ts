import { type ServerEnvironment, envToCfg } from '../src/config/index.js'

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
})
