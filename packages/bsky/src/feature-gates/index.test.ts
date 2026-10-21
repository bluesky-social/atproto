import type express from 'express'
import { describe, expect, it } from 'vitest'
import { FeatureGatesClient } from './index.js'

function request(headers: HeadersInit): express.Request {
  const values = new Headers(headers)
  return {
    header: (name: string) => values.get(name) ?? undefined,
  } as express.Request
}

describe('FeatureGatesClient.parseUserContextFromHandler', () => {
  const client = new FeatureGatesClient({})

  it('reads AT Protocol device and session headers', () => {
    const context = client.parseUserContextFromHandler({
      viewer: 'did:example:alice',
      req: request({
        'x-atproto-device-id': 'device-123',
        'x-atproto-session-id': 'session-456',
      }),
    })

    expect(context).toEqual({
      did: 'did:example:alice',
      deviceId: 'device-123',
      sessionId: 'session-456',
    })
  })
})
