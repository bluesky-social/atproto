import { describe, expect, it, vi } from 'vitest'
import type { DidString } from '@atproto/lex'
import { Gate } from '../../../../feature-gates/gates.js'
import { irisUrlForFeed } from './getFeed.js'

const IRIS_URL = 'http://iris.internal.invalid'
const ALLOWLISTED = 'at://did:plc:feedgen/app.bsky.feed.generator/whats-hot'
const OTHER_FEED = 'at://did:plc:someone/app.bsky.feed.generator/custom'

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
