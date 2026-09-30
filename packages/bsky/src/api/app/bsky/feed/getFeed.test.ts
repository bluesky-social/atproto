import { describe, expect, it, vi } from 'vitest'
import type { DidString } from '@atproto/lex'
import { Gate } from '../../../../feature-gates/gates.js'
import {
  irisStagingUrlForFeed,
  irisUrlForFeed,
  irisUrlForTrendingFeed,
  seeemoreUrlForFeed,
} from './getFeed.js'

const IRIS_URL = 'http://iris.internal.invalid'
const IRIS_STAGING_URL = 'http://iris-staging.internal.invalid'
const SEEEMORE_URL = 'http://seeemore.internal.invalid'
const ALLOWLISTED = 'at://did:plc:feedgen/app.bsky.feed.generator/whats-hot'
const OTHER_FEED = 'at://did:plc:someone/app.bsky.feed.generator/custom'
const TRENDING_FEED_DID: DidString = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa'
const TRENDING_FEED = `at://${TRENDING_FEED_DID}/app.bsky.feed.generator/topic`
const IRIS_SERVICE_DID: DidString = 'did:web:iris.invalid'
const OTHER_SERVICE_DID: DidString = 'did:web:feedgen.invalid'
const SEEEMORE_SERVICE_DID: DidString = 'did:web:discover.bsky.app'

const inputs = ({
  irisConfigured = true,
  allowlistConfigured = true,
  irisFeedUris = [ALLOWLISTED],
  feed = ALLOWLISTED,
  viewer = 'did:plc:viewer' as DidString | null,
  gate = true,
} = {}) => {
  const checkGate = vi.fn((g: Gate) => (g === Gate.IrisFeed ? gate : false))
  return {
    checkGate,
    cfg: {
      irisUrl: irisConfigured ? IRIS_URL : undefined,
      irisFeedUris: allowlistConfigured ? new Set(irisFeedUris) : undefined,
    },
    params: { feed, hydrateCtx: { viewer, features: { Gate, checkGate } } },
  }
}

describe('irisUrlForFeed', () => {
  it('routes an allowlisted feed to iris for a gated-in viewer', () => {
    const { cfg, params } = inputs()
    expect(irisUrlForFeed(cfg, params)).toBe(IRIS_URL)
  })

  it('does not route when the gate is off', () => {
    const { cfg, params } = inputs({ gate: false })
    expect(irisUrlForFeed(cfg, params)).toBeUndefined()
  })

  it('does not route a feed that is not allowlisted', () => {
    const { cfg, params } = inputs({ feed: OTHER_FEED })
    expect(irisUrlForFeed(cfg, params)).toBeUndefined()
  })

  it('does not route when iris is not configured', () => {
    const { cfg, params } = inputs({ irisConfigured: false })
    expect(irisUrlForFeed(cfg, params)).toBeUndefined()
  })

  it('does not route when no allowlist is configured', () => {
    const { cfg, params } = inputs({ allowlistConfigured: false })
    expect(irisUrlForFeed(cfg, params)).toBeUndefined()
  })

  // Unauthed viewers have no stable bucket, so they'd flip backends between
  // pages and send a cursor to the backend that did not mint it.
  it('does not route unauthed requests', () => {
    const { cfg, params } = inputs({ viewer: null })
    expect(irisUrlForFeed(cfg, params)).toBeUndefined()
  })

  // Evaluating the gate emits a GrowthBook exposure event. This runs for every
  // custom feed on the network, so it must not fire for requests that could
  // never be routed to iris.
  describe('does not evaluate the gate', () => {
    it('for a feed that is not allowlisted', () => {
      const { cfg, params, checkGate } = inputs({ feed: OTHER_FEED })
      irisUrlForFeed(cfg, params)
      expect(checkGate).not.toHaveBeenCalled()
    })

    it('for an unauthed request', () => {
      const { cfg, params, checkGate } = inputs({ viewer: null })
      irisUrlForFeed(cfg, params)
      expect(checkGate).not.toHaveBeenCalled()
    })

    it('when iris is not configured', () => {
      const { cfg, params, checkGate } = inputs({ irisConfigured: false })
      irisUrlForFeed(cfg, params)
      expect(checkGate).not.toHaveBeenCalled()
    })

    it('when no allowlist is configured', () => {
      const { cfg, params, checkGate } = inputs({ allowlistConfigured: false })
      irisUrlForFeed(cfg, params)
      expect(checkGate).not.toHaveBeenCalled()
    })
  })
})

describe('irisStagingUrlForFeed', () => {
  const stagingCfg = ({
    irisStagingConfigured = true,
    allowlistConfigured = true,
  } = {}) => ({
    irisStagingUrl: irisStagingConfigured ? IRIS_STAGING_URL : undefined,
    irisStagingFeedUris: allowlistConfigured
      ? new Set([ALLOWLISTED])
      : undefined,
  })

  it('routes an allowlisted feed to iris staging', () => {
    const url = irisStagingUrlForFeed(stagingCfg(), { feed: ALLOWLISTED })
    expect(url).toBe(IRIS_STAGING_URL)
  })

  it('does not route a feed that is not allowlisted', () => {
    const url = irisStagingUrlForFeed(stagingCfg(), { feed: OTHER_FEED })
    expect(url).toBeUndefined()
  })

  it('does not route when iris staging is not configured', () => {
    const cfg = stagingCfg({ irisStagingConfigured: false })
    expect(irisStagingUrlForFeed(cfg, { feed: ALLOWLISTED })).toBeUndefined()
  })

  it('does not route when no allowlist is configured', () => {
    const cfg = stagingCfg({ allowlistConfigured: false })
    expect(irisStagingUrlForFeed(cfg, { feed: ALLOWLISTED })).toBeUndefined()
  })
})

describe(irisUrlForTrendingFeed, () => {
  const cfg = {
    irisUrl: IRIS_URL,
    irisServiceDid: IRIS_SERVICE_DID,
    trendingFeedDid: TRENDING_FEED_DID,
  }

  it('routes a configured trending feed registered to Iris', () => {
    const url = irisUrlForTrendingFeed(cfg, {
      feed: TRENDING_FEED,
      feedDid: IRIS_SERVICE_DID,
    })
    expect(url).toBe(IRIS_URL)
  })

  it('does not route a feed published by another account', () => {
    const url = irisUrlForTrendingFeed(cfg, {
      feed: OTHER_FEED,
      feedDid: IRIS_SERVICE_DID,
    })
    expect(url).toBeUndefined()
  })

  it('does not route a feed registered to another service', () => {
    const url = irisUrlForTrendingFeed(cfg, {
      feed: TRENDING_FEED,
      feedDid: OTHER_SERVICE_DID,
    })
    expect(url).toBeUndefined()
  })

  it('does not route when Iris is not configured', () => {
    const url = irisUrlForTrendingFeed(
      { ...cfg, irisUrl: undefined },
      { feed: TRENDING_FEED, feedDid: IRIS_SERVICE_DID },
    )
    expect(url).toBeUndefined()
  })

  it('does not route when the Iris service DID is not configured', () => {
    const url = irisUrlForTrendingFeed(
      { ...cfg, irisServiceDid: undefined },
      { feed: TRENDING_FEED, feedDid: IRIS_SERVICE_DID },
    )
    expect(url).toBeUndefined()
  })

  it('does not route when the trending feed DID is not configured', () => {
    const url = irisUrlForTrendingFeed(
      { ...cfg, trendingFeedDid: undefined },
      { feed: TRENDING_FEED, feedDid: IRIS_SERVICE_DID },
    )
    expect(url).toBeUndefined()
  })
})

describe(seeemoreUrlForFeed, () => {
  const cfg = {
    seeemoreUrl: SEEEMORE_URL,
    seeemoreServiceDid: SEEEMORE_SERVICE_DID,
  }

  it('routes feeds registered to seeemore to its local endpoint', () => {
    expect(seeemoreUrlForFeed(cfg, { feedDid: SEEEMORE_SERVICE_DID })).toBe(
      SEEEMORE_URL,
    )
  })

  it('preserves the registered endpoint for feeds hosted elsewhere', () => {
    expect(
      seeemoreUrlForFeed(cfg, { feedDid: OTHER_SERVICE_DID }),
    ).toBeUndefined()
  })

  it('falls back to DID resolution unless both settings are configured', () => {
    expect(
      seeemoreUrlForFeed(
        { ...cfg, seeemoreUrl: undefined },
        {
          feedDid: SEEEMORE_SERVICE_DID,
        },
      ),
    ).toBeUndefined()
    expect(
      seeemoreUrlForFeed(
        { ...cfg, seeemoreServiceDid: undefined },
        {
          feedDid: SEEEMORE_SERVICE_DID,
        },
      ),
    ).toBeUndefined()
  })
})
