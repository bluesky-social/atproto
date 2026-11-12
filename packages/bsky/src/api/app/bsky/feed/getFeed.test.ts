import { describe, expect, it, vi } from 'vitest'
import type { DidString } from '@atproto/lex'
import { Gate } from '../../../../feature-gates/gates.js'
import {
  irisStagingUrlForFeed,
  irisUrlForFeed,
  irisUrlForTrendingFeed,
} from './getFeed.js'

const IRIS_URL = 'http://iris.internal.invalid'
const IRIS_STAGING_URL = 'http://iris-staging.internal.invalid'
const ALLOWLISTED = 'at://did:plc:feedgen/app.bsky.feed.generator/whats-hot'
const OTHER_FEED = 'at://did:plc:someone/app.bsky.feed.generator/custom'
const TRENDING_FEED_DID: DidString = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa'
const TRENDING_FEED = `at://${TRENDING_FEED_DID}/app.bsky.feed.generator/topic`
const IRIS_SERVICE_DID: DidString = 'did:web:iris.invalid'
const OTHER_SERVICE_DID: DidString = 'did:web:feedgen.invalid'

const inputs = ({
  irisConfigured = true,
  allowlistConfigured = true,
  irisFeedUris = [ALLOWLISTED],
  feed = ALLOWLISTED,
  viewer = 'did:plc:viewer' as DidString | null,
  stableDeviceId = 'stable-device-id' as string | null,
  gate = true,
  feedGates = {} as Partial<Record<Gate, boolean>>,
} = {}) => {
  const checkGate = vi.fn(
    (g: Gate) => feedGates[g] ?? (g === Gate.IrisFeed ? gate : false),
  )
  return {
    checkGate,
    cfg: {
      irisUrl: irisConfigured ? IRIS_URL : undefined,
      irisFeedUris: allowlistConfigured ? new Set(irisFeedUris) : undefined,
    },
    params: {
      feed,
      stableDeviceId,
      hydrateCtx: { viewer, features: { Gate, checkGate } },
    },
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

  // Logged-out viewers are bucketed by their stable device id (stable_id)
  // instead of a DID, so they route behind a dedicated gate.
  describe('logged-out viewers', () => {
    it('does not route when the logged-out gate is off', () => {
      const { cfg, params } = inputs({ viewer: null })
      expect(irisUrlForFeed(cfg, params)).toBeUndefined()
    })

    it('routes when the logged-out gate is on', () => {
      const { cfg, params } = inputs({
        viewer: null,
        feedGates: { [Gate.IrisFeedLoggedOutEnable]: true },
      })
      expect(irisUrlForFeed(cfg, params)).toBe(IRIS_URL)
    })

    it('evaluates only the logged-out gate, not the per-feed gate', () => {
      const { cfg, params, checkGate } = inputs({ viewer: null })
      irisUrlForFeed(cfg, params)
      expect(checkGate).toHaveBeenCalledTimes(1)
      expect(checkGate).toHaveBeenCalledWith(Gate.IrisFeedLoggedOutEnable)
    })

    it('does not route without a stable device id, even when the gate is on', () => {
      const { cfg, params, checkGate } = inputs({
        viewer: null,
        stableDeviceId: null,
        feedGates: { [Gate.IrisFeedLoggedOutEnable]: true },
      })
      expect(irisUrlForFeed(cfg, params)).toBeUndefined()
      expect(checkGate).not.toHaveBeenCalled()
    })
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

  describe('per-feed gates', () => {
    const dedicatedFeeds = [
      ['with-friends', Gate.IrisFeedWithFriendsEnable],
      ['thevids', Gate.IrisFeedThevidsEnable],
      ['mutuals', Gate.IrisFeedMutualsEnable],
      ['bsky-team', Gate.IrisFeedBskyTeamEnable],
      ['best-of-follows', Gate.IrisFeedBestOfFollowsEnable],
      ['followpics', Gate.IrisFeedFollowpicsEnable],
    ] as const

    it.each(dedicatedFeeds)(
      'routes %s only when its dedicated gate is on',
      (rkey, dedicatedGate) => {
        const feed = `at://did:plc:feedgen/app.bsky.feed.generator/${rkey}`
        const irisFeedUris = [ALLOWLISTED, feed]
        const on = inputs({
          feed,
          irisFeedUris,
          feedGates: { [dedicatedGate]: true },
        })
        expect(irisUrlForFeed(on.cfg, on.params)).toBe(IRIS_URL)

        // The default gate being on must not route a feed that has its own.
        const off = inputs({ feed, irisFeedUris })
        expect(irisUrlForFeed(off.cfg, off.params)).toBeUndefined()
        expect(off.checkGate).toHaveBeenCalledWith(dedicatedGate)
        expect(off.checkGate).not.toHaveBeenCalledWith(Gate.IrisFeed)
      },
    )

    it('keeps whats-hot on the original gate', () => {
      const { cfg, params, checkGate } = inputs({
        feedGates: { [Gate.IrisFeedWithFriendsEnable]: true },
      })
      expect(irisUrlForFeed(cfg, params)).toBe(IRIS_URL)
      expect(checkGate).toHaveBeenCalledWith(Gate.IrisFeed)
      expect(checkGate).not.toHaveBeenCalledWith(Gate.IrisFeedWithFriendsEnable)
    })

    it('falls back to the default gate for allowlisted feeds without a dedicated one', () => {
      const other = 'at://did:plc:feedgen/app.bsky.feed.generator/some-other'
      const { cfg, params, checkGate } = inputs({
        feed: other,
        irisFeedUris: [other],
      })
      expect(irisUrlForFeed(cfg, params)).toBe(IRIS_URL)
      expect(checkGate).toHaveBeenCalledWith(Gate.IrisFeed)
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
