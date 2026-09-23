import { describe, expect, it, vi } from 'vitest'
import type { AtUriString, DidString } from '@atproto/lex'
import type { AppContext } from '../../../../context.js'
import { Gate } from '../../../../feature-gates/gates.js'
import {
  irisStagingUrlForFeed,
  irisUrlForFeed,
  resolveSkeletonEndpoint,
} from './getFeed.js'

const IRIS_URL = 'http://iris.internal.invalid'
const IRIS_STAGING_URL = 'http://iris-staging.internal.invalid'
const ALLOWLISTED =
  'at://did:plc:feedgen/app.bsky.feed.generator/whats-hot' as AtUriString
const REGISTERED_URL = 'https://seeemore.internal.invalid'
const OTHER_FEED =
  'at://did:plc:someone/app.bsky.feed.generator/custom' as AtUriString

const inputs = ({
  irisConfigured = true,
  allowlistConfigured = true,
  irisFeedUris = [ALLOWLISTED],
  feed = ALLOWLISTED,
  viewer = null as DidString | null,
  stableId = 'stable-device-123',
  gate = true,
} = {}) => {
  const checkGate = vi.fn(
    (g: Gate, overrides?: { deviceId?: string }) =>
      g === Gate.IrisFeed && overrides?.deviceId === stableId && gate,
  )
  return {
    checkGate,
    cfg: {
      irisUrl: irisConfigured ? IRIS_URL : undefined,
      irisFeedUris: allowlistConfigured ? new Set(irisFeedUris) : undefined,
    },
    params: {
      feed,
      stableId,
      hydrateCtx: { viewer, features: { Gate, checkGate } },
    },
  }
}

describe('irisUrlForFeed', () => {
  it('routes an allowlisted feed to iris for a gated-in guest', () => {
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

  // Evaluating the gate emits a GrowthBook exposure event. This runs for every
  // custom feed on the network, so it must not fire for requests that could
  // never be routed to iris.
  describe('does not evaluate the gate', () => {
    it('for an authenticated viewer, even with a stable ID', () => {
      const { cfg, params, checkGate } = inputs({
        viewer: 'did:plc:viewer' as DidString,
      })
      expect(irisUrlForFeed(cfg, params)).toBeUndefined()
      expect(checkGate).not.toHaveBeenCalled()
    })

    it('for a feed that is not allowlisted', () => {
      const { cfg, params, checkGate } = inputs({ feed: OTHER_FEED })
      irisUrlForFeed(cfg, params)
      expect(checkGate).not.toHaveBeenCalled()
    })

    it('for a guest without a stable ID', () => {
      const { cfg, params, checkGate } = inputs({ stableId: '' })
      expect(irisUrlForFeed(cfg, params)).toBeUndefined()
      expect(checkGate).not.toHaveBeenCalled()
    })

    it('for a guest with an empty stable ID', () => {
      const { cfg, params, checkGate } = inputs({
        viewer: null,
        stableId: '   ',
      })
      expect(irisUrlForFeed(cfg, params)).toBeUndefined()
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

describe('resolveSkeletonEndpoint', () => {
  it('uses the registered generator for a gated-out guest even when staging is configured', async () => {
    const { cfg, params, checkGate } = inputs({ gate: false })
    const getFeedGens = vi
      .fn()
      .mockResolvedValue(
        new Map([[ALLOWLISTED, { record: { did: 'did:plc:feedgen' } }]]),
      )
    const getIdentityByDid = vi.fn().mockResolvedValue({
      services: new TextEncoder().encode(
        JSON.stringify({
          bsky_fg: { Type: 'BskyFeedGenerator', URL: REGISTERED_URL },
        }),
      ),
    })
    const ctx = {
      cfg: {
        ...cfg,
        irisStagingUrl: IRIS_STAGING_URL,
        irisStagingFeedUris: new Set([ALLOWLISTED]),
      },
      hydrator: { feed: { getFeedGens } },
      dataplane: { getIdentityByDid },
    } as unknown as AppContext

    await expect(resolveSkeletonEndpoint(ctx, params)).resolves.toBe(
      REGISTERED_URL,
    )
    expect(checkGate).toHaveBeenCalledWith(Gate.IrisFeed, {
      deviceId: params.stableId,
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
