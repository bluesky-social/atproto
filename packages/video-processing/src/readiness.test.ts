import { describe, expect, it, vi } from 'vitest'
import { HttpReadinessChecker } from './readiness'

describe('HttpReadinessChecker', () => {
  it('returns false when master playlist is missing', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 404 }))
    const checker = new HttpReadinessChecker(
      fetchImpl as unknown as typeof fetch,
    )
    await expect(
      checker.isReady('https://stream.example/uid/manifest/video.m3u8'),
    ).resolves.toBe(false)
  })

  it('follows master → media playlist → first segment', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.endsWith('/manifest/video.m3u8') && method === 'HEAD') {
        return new Response(null, { status: 200 })
      }
      if (url.endsWith('/manifest/video.m3u8')) {
        return new Response(
          '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nv540/index.m3u8\n',
          { status: 200 },
        )
      }
      if (url.endsWith('/v540/index.m3u8')) {
        return new Response('#EXTM3U\n#EXTINF:2,\nseg0.ts\n', { status: 200 })
      }
      if (url.endsWith('/v540/seg0.ts') && method === 'HEAD') {
        return new Response(null, { status: 200 })
      }
      return new Response('missing', { status: 404 })
    })
    const checker = new HttpReadinessChecker(
      fetchImpl as unknown as typeof fetch,
    )
    await expect(
      checker.isReady('https://stream.example/uid/manifest/video.m3u8'),
    ).resolves.toBe(true)
  })
})
