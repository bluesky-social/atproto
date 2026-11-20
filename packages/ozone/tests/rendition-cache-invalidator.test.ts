import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { RenditionCacheInvalidator } from '../src/image-invalidator.js'

describe('RenditionCacheInvalidator', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('invalidates and restores within the configured origin', async () => {
    using fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }))
    const invalidator = new RenditionCacheInvalidator({
      endpoint: 'https://renders.example',
      token: '0123456789abcdef0123456789abcdef',
    })

    await invalidator.invalidate('did:plc:alice', 'bafkreiexample')
    await invalidator.restore('did:plc:alice', 'bafkreiexample')

    for (const [index, operation] of ['invalidate', 'restore'].entries()) {
      expect(fetch).toHaveBeenNthCalledWith(
        index + 1,
        `https://renders.example/internal/v1/source/${operation}`,
        {
          method: 'POST',
          redirect: 'error',
          headers: {
            Authorization: 'Bearer 0123456789abcdef0123456789abcdef',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            did: 'did:plc:alice',
            cid: 'bafkreiexample',
          }),
          signal: expect.any(AbortSignal),
        },
      )
    }
  })

  it('surfaces failed status responses', async () => {
    using _fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 503 }))
    const invalidator = new RenditionCacheInvalidator({
      endpoint: 'https://renders.example',
      token: '0123456789abcdef0123456789abcdef',
    })
    await expect(
      invalidator.invalidate('did:plc:alice', 'bafkreiexample'),
    ).rejects.toThrow('rendition cache request failed with status 503')
  })

  it('requires a fixed origin and sufficient token', () => {
    expect(
      () =>
        new RenditionCacheInvalidator({
          endpoint: 'https://renders.example/path',
          token: '0123456789abcdef0123456789abcdef',
        }),
    ).toThrow()
    expect(
      () =>
        new RenditionCacheInvalidator({
          endpoint: 'https://renders.example',
          token: 'short',
        }),
    ).toThrow()
  })
})
