import { describe, expect, it, vi } from 'vitest'
import { CloudflareStreamClient } from './cloudflare-stream'

describe('CloudflareStreamClient', () => {
  it('normalizes bare customer codes to the Stream host', async () => {
    const bare = new CloudflareStreamClient({
      accountId: 'acct',
      apiToken: 'token',
      customerSubdomain: 'txmmldn42ev278pb',
    })
    expect(bare.getPlaybackUrl('abc123')).toBe(
      'https://customer-txmmldn42ev278pb.cloudflarestream.com/abc123/manifest/video.m3u8',
    )
    const prefixed = new CloudflareStreamClient({
      accountId: 'acct',
      apiToken: 'token',
      customerSubdomain: 'customer-xyz',
    })
    expect(prefixed.getPlaybackUrl('abc123')).toBe(
      'https://customer-xyz.cloudflarestream.com/abc123/manifest/video.m3u8',
    )
  })

  it('copies from URL and builds playback URL from customer subdomain', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        success: true,
        result: { uid: 'abc123', readyToStream: false },
      }),
    )
    const client = new CloudflareStreamClient({
      accountId: 'acct',
      apiToken: 'token',
      customerSubdomain: 'https://customer-xyz.cloudflarestream.com',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const uploaded = await client.copyFromUrl({
      url: 'https://media.example/v1/media/did/cid',
      meta: { did: 'did:plc:a', videoCid: 'bafy' },
    })
    expect(uploaded.uid).toBe('abc123')
    expect(uploaded.playbackUrl).toBeUndefined()
    expect(client.getPlaybackUrl('abc123')).toBe(
      'https://customer-xyz.cloudflarestream.com/abc123/manifest/video.m3u8',
    )
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/acct/stream/copy',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('uses playback.hls from Stream when readyToStream is true', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        success: true,
        result: {
          uid: 'abc123',
          readyToStream: true,
          playback: {
            hls: 'https://customer-xyz.cloudflarestream.com/abc123/manifest/video.m3u8',
          },
        },
      }),
    )
    const client = new CloudflareStreamClient({
      accountId: 'acct',
      apiToken: 'token',
      customerSubdomain: 'https://customer-xyz.cloudflarestream.com',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const uploaded = await client.copyFromUrl({
      url: 'https://media.example/v1/media/did/cid',
      meta: { did: 'did:plc:a', videoCid: 'bafy' },
    })
    expect(uploaded.playbackUrl).toContain('/manifest/video.m3u8')
  })

  it('treats delete 404 as success', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 }))
    const client = new CloudflareStreamClient({
      accountId: 'acct',
      apiToken: 'token',
      customerSubdomain: 'https://customer-xyz.cloudflarestream.com',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(client.delete('missing')).resolves.toBeUndefined()
  })
})
