import type express from 'express'
import { describe, expect, it } from 'vitest'
import { FeatureGatesClient } from './index.js'

describe('FeatureGatesClient', () => {
  it('parses the beta user header into the user context', () => {
    const client = new FeatureGatesClient({})
    const headers: Record<string, string> = {
      'x-bsky-device-id': 'device-123',
      'x-bsky-session-id': 'session-456',
      'x-bsky-is-beta-user': 'TRUE',
    }
    const req = {
      header: (name: string) => headers[name.toLowerCase()],
    } as unknown as express.Request

    expect(
      client.parseUserContextFromHandler({
        viewer: 'did:example:alice',
        req,
      }),
    ).toEqual({
      did: 'did:example:alice',
      deviceId: 'device-123',
      sessionId: 'session-456',
      isBetaUser: true,
    })
  })
})
