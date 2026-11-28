import { afterEach, describe, expect, it, vi } from 'vitest'
import { VideoInvalidator } from './video-invalidator.js'

describe('VideoInvalidator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('purges the video by did and cid', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }))
    const invalidator = new VideoInvalidator({
      url: 'https://video.example/xrpc/app.bsky.video.purgeVideo',
      helperKey: 'secret',
    })

    await invalidator.invalidate('did:plc:alice', 'bafyvideo')

    expect(fetch).toHaveBeenCalledWith(
      'https://video.example/xrpc/app.bsky.video.purgeVideo?did=did%3Aplc%3Aalice&cid=bafyvideo',
      {
        method: 'POST',
        headers: { 'helper-key': 'secret' },
        signal: expect.any(AbortSignal),
      },
    )
  })

  it('throws when the purge fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500 }),
    )
    const invalidator = new VideoInvalidator({
      url: 'https://video.example/xrpc/app.bsky.video.purgeVideo',
      helperKey: 'secret',
    })

    await expect(
      invalidator.invalidate('did:plc:alice', 'bafyvideo'),
    ).rejects.toThrow('Video invalidation failed with status 500')
  })
})
