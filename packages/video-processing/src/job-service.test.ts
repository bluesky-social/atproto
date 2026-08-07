import { describe, expect, it, vi } from 'vitest'
import { isAllowedMediaSourceUrl, mediaSourceUrl } from './index'
import { StreamUidMismatchError, VideoJobService } from './job-service'
import type {
  AssetStore,
  ReadinessChecker,
  StreamClient,
  VideoAssetRecord,
} from './types'

const did = 'did:plc:alice'
const videoCid = 'bafkreibm6jg3ux5qux2m7g5w4hfuaf2mp4xg6t4n2v5x6iiys5ndq4nohq'

class MemoryStore implements AssetStore {
  private rows = new Map<string, VideoAssetRecord>()
  private key(did: string, videoCid: string) {
    return `${did}/${videoCid}`
  }
  async get(did: string, videoCid: string) {
    return this.rows.get(this.key(did, videoCid))
  }
  async put(record: VideoAssetRecord) {
    this.rows.set(this.key(record.did, record.videoCid), record)
    return record
  }
}

function streamClient(
  overrides: Partial<StreamClient> = {},
): StreamClient & { copyFromUrl: ReturnType<typeof vi.fn> } {
  const copyFromUrl = vi.fn(async () => ({
    uid: 'stream-uid-1',
    playbackUrl: undefined as string | undefined,
  }))
  return {
    copyFromUrl,
    getPlaybackUrl: (uid) =>
      `https://stream.example/${uid}/manifest/video.m3u8`,
    delete: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('VideoJobService', () => {
  it('submits idempotently for the same did+cid', async () => {
    const store = new MemoryStore()
    const stream = streamClient()
    const readiness: ReadinessChecker = { isReady: async () => false }
    const service = new VideoJobService(store, stream, readiness)

    const first = await service.submit({
      did,
      videoCid,
      sourceUrl: 'https://cdn.example/v1/media/a/b',
    })
    const second = await service.submit({
      did,
      videoCid,
      sourceUrl: 'https://cdn.example/v1/media/a/b',
    })

    expect(first.state).toBe('processing')
    expect(first.streamUid).toBe('stream-uid-1')
    expect(second.streamUid).toBe('stream-uid-1')
    expect(stream.copyFromUrl).toHaveBeenCalledTimes(1)
  })

  it('marks ready only after readiness check passes', async () => {
    const store = new MemoryStore()
    const stream = streamClient({
      copyFromUrl: vi.fn(async () => ({
        uid: 'stream-uid-1',
        playbackUrl: 'https://stream.example/stream-uid-1/manifest/video.m3u8',
      })),
    })
    const readiness = { isReady: vi.fn(async () => false) }
    const service = new VideoJobService(store, stream, readiness)

    const pending = await service.submit({
      did,
      videoCid,
      sourceUrl: 'https://cdn.example/v1/media/a/b',
    })
    expect(pending.state).toBe('processing')
    expect(pending.playlistUrl).toBeUndefined()

    readiness.isReady.mockResolvedValueOnce(true)
    const ready = await service.markReadyFromWebhook(
      did,
      videoCid,
      'stream-uid-1',
    )
    expect(ready?.state).toBe('ready')
    expect(ready?.playlistUrl).toBe(
      'https://stream.example/stream-uid-1/manifest/video.m3u8',
    )
  })

  it('distinguishes permanent vs retryable failures', async () => {
    const store = new MemoryStore()
    const stream = streamClient({
      copyFromUrl: vi.fn(async () => {
        throw new Error('unsupported codec')
      }),
    })
    const service = new VideoJobService(store, stream, {
      isReady: async () => false,
    })

    const failed = await service.submit({
      did,
      videoCid,
      sourceUrl: 'https://cdn.example/v1/media/a/b',
    })
    expect(failed.state).toBe('failed')
    expect(failed.error).toBe('InvalidSource')

    // Permanent failures are not retried into a new Stream copy.
    await service.submit({
      did,
      videoCid,
      sourceUrl: 'https://cdn.example/v1/media/a/b',
    })
    expect(stream.copyFromUrl).toHaveBeenCalledTimes(1)
  })

  it('deletes Stream uid and marks ModerationBlocked', async () => {
    const store = new MemoryStore()
    const stream = streamClient()
    const service = new VideoJobService(store, stream, {
      isReady: async () => false,
    })
    await service.submit({
      did,
      videoCid,
      sourceUrl: 'https://cdn.example/v1/media/a/b',
    })
    const deleted = await service.delete(did, videoCid)
    expect(stream.delete).toHaveBeenCalledWith('stream-uid-1')
    expect(deleted?.state).toBe('failed')
    expect(deleted?.error).toBe('ModerationBlocked')
    expect(deleted?.playlistUrl).toBeUndefined()
  })

  it('rejects webhook stream uids that do not match the stored job', async () => {
    const store = new MemoryStore()
    const stream = streamClient()
    const service = new VideoJobService(store, stream, {
      isReady: async () => true,
    })
    await service.submit({
      did,
      videoCid,
      sourceUrl: 'https://cdn.example/v1/media/a/b',
    })
    await expect(
      service.markReadyFromWebhook(did, videoCid, 'other-uid'),
    ).rejects.toBeInstanceOf(StreamUidMismatchError)
  })
})

describe('isAllowedMediaSourceUrl', () => {
  const cdn = 'https://media.example'

  it('allows same-origin /v1/media/:did/:cid URLs', () => {
    const url = mediaSourceUrl(cdn, did, videoCid)
    expect(isAllowedMediaSourceUrl(url, cdn)).toBe(true)
  })

  it('rejects off-origin and non-media paths', () => {
    expect(
      isAllowedMediaSourceUrl('https://evil.example/v1/media/a/b', cdn),
    ).toBe(false)
    expect(isAllowedMediaSourceUrl(`${cdn}/v1/hls/a/b/master.m3u8`, cdn)).toBe(
      false,
    )
    expect(isAllowedMediaSourceUrl(`${cdn}/v1/media/only-one`, cdn)).toBe(false)
  })
})
