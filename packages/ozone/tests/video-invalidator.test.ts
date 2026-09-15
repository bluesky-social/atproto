import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { VideoInvalidator } from '../src/video-invalidator.js'

describe('VideoInvalidator', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('purges the video by did and cid', async () => {
    const fetch = jest
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
      },
    )
  })

  it('throws when the purge fails', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 500 }))
    const invalidator = new VideoInvalidator({
      url: 'https://video.example/xrpc/app.bsky.video.purgeVideo',
      helperKey: 'secret',
    })

    await expect(
      invalidator.invalidate('did:plc:alice', 'bafyvideo'),
    ).rejects.toThrow('Video invalidation failed with status 500')
  })
})
