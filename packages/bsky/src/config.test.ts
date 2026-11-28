import { afterEach, describe, expect, it, vi } from 'vitest'
import { ServerConfig } from './config.js'

describe(ServerConfig, () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reads the Atmosphere Explore service URL from BSKY_ATMOSPHERE_EXPLORE_TAB_SERVICE', () => {
    const service = 'https://cms.bsky.app/atmosphere-explore-tab'
    vi.stubEnv('BSKY_ATMOSPHERE_EXPLORE_TAB_SERVICE', service)
    vi.stubEnv('BSKY_BSYNC_URL', 'http://localhost:3000')
    vi.stubEnv('MOD_SERVICE_DID', 'did:plc:labeler')
    expect(
      ServerConfig.readEnv({ dataplaneUrls: ['http://localhost:3001'] })
        .atmosphereExploreTabService,
    ).toBe(service)
  })
})
