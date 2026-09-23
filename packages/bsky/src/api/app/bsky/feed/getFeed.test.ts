import { describe, expect, it, vi } from 'vitest'
import type { DidString } from '@atproto/lex'
import { Gate } from '../../../../feature-gates/gates.js'
import { irisStagingUrlForFeed, irisUrlForFeed } from './getFeed.js'

const IRIS_URL = 'http://iris.internal.invalid'
const IRIS_STAGING_URL = 'http://iris-staging.internal.invalid'
const ALLOWLISTED = 'at://did:plc:feedgen/app.bsky.feed.generator/whats-hot'
const OTHER_FEED = 'at://did:plc:someone/app.bsky.feed.generator/custom'

const inputs = ({
  irisConfigured = true,
  allowlistConfigured = true,
  irisFeedUris = [ALLOWLISTED],
  feed = ALLOWLISTED,
  viewer = 'did:plc:viewer' as DidString | null,
  stableId = '',
  gate = true,
} = {}) => {
  const checkGate = vi.fn(
    (g: Gate, overrides?: { deviceId?: string }) =>
      g === Gate.IrisFeed &&
      (viewer ? overrides === undefined : overrides?.deviceId === stableId) &&
      gate,
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

  it('routes a guest with a stable ID in the same Iris gate', () => {
    const { cfg, params } = inputs({
      viewer: null,
      stableId: 'stable-device-123',
    })
    expect(irisUrlForFeed(cfg, params)).toBe(IRIS_URL)
  })

  it('leaves a stable guest on the registered generator when gated out', () => {
    const { cfg, params } = inputs({
      viewer: null,
      stableId: 'stable-device-123',
      gate: false,
    })
    expect(irisUrlForFeed(cfg, params)).toBeUndefined()
  })

  it('keeps authenticated assignment on the viewer DID', () => {
    const { cfg, params } = inputs({ stableId: 'device-id' })
    expect(irisUrlForFeed(cfg, params)).toBe(IRIS_URL)
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

    it('for a guest without a stable ID', () => {
      const { cfg, params, checkGate } = inputs({ viewer: null })
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
