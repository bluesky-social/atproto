import {
  type AssetStore,
  MAX_ATTEMPTS,
  type ReadinessChecker,
  type StreamClient,
  type SubmitJobInput,
  type VideoAssetRecord,
  type VideoFailureCategory,
  classifyStreamError,
  isRetryableFailure,
} from './types'

export class StreamUidMismatchError extends Error {
  constructor(message = 'stream uid does not match stored job') {
    super(message)
    this.name = 'StreamUidMismatchError'
  }
}

export class VideoJobService {
  constructor(
    private store: AssetStore,
    private stream: StreamClient,
    private readiness: ReadinessChecker,
    private now: () => string = () => new Date().toISOString(),
  ) {}

  /**
   * Idempotent submit keyed by did+videoCid. Duplicate calls do not create a
   * second Stream copy when a uid already exists.
   */
  async submit(input: SubmitJobInput): Promise<VideoAssetRecord> {
    const existing = await this.store.get(input.did, input.videoCid)
    if (existing?.state === 'ready' && existing.playlistUrl) {
      return existing
    }
    if (existing?.streamUid && existing.state === 'processing') {
      return existing
    }
    if (
      existing?.state === 'failed' &&
      existing.error &&
      !isRetryableFailure(existing.error)
    ) {
      return existing
    }
    if (existing && existing.attempts >= MAX_ATTEMPTS) {
      return this.fail(existing, existing.error ?? 'TranscodeFailed')
    }

    const attempts = (existing?.attempts ?? 0) + 1
    const processing: VideoAssetRecord = {
      did: input.did,
      videoCid: input.videoCid,
      state: 'processing',
      streamUid: existing?.streamUid,
      playlistUrl: undefined,
      error: undefined,
      attempts,
      updatedAt: this.now(),
    }
    await this.store.put(processing)

    try {
      if (!processing.streamUid) {
        const uploaded = await this.stream.copyFromUrl({
          url: input.sourceUrl,
          meta: { did: input.did, videoCid: input.videoCid },
        })
        processing.streamUid = uploaded.uid
        if (uploaded.playbackUrl) {
          return this.tryMarkReady(processing, uploaded.playbackUrl)
        }
        return this.store.put({ ...processing, updatedAt: this.now() })
      }
      return processing
    } catch (err) {
      const category = classifyStreamError(err)
      if (isRetryableFailure(category) && attempts < MAX_ATTEMPTS) {
        return this.store.put({
          ...processing,
          state: 'processing',
          error: undefined,
          updatedAt: this.now(),
        })
      }
      return this.fail(processing, category)
    }
  }

  async markReadyFromWebhook(
    did: string,
    videoCid: string,
    streamUid: string,
  ): Promise<VideoAssetRecord | undefined> {
    const existing = await this.store.get(did, videoCid)
    if (!existing) return
    if (existing.streamUid && existing.streamUid !== streamUid) {
      throw new StreamUidMismatchError()
    }
    const playlistUrl = this.stream.getPlaybackUrl(streamUid)
    return this.tryMarkReady(
      { ...existing, streamUid, state: 'processing' },
      playlistUrl,
    )
  }

  async delete(
    did: string,
    videoCid: string,
  ): Promise<VideoAssetRecord | undefined> {
    const existing = await this.store.get(did, videoCid)
    if (!existing) return
    if (existing.streamUid) {
      await this.stream.delete(existing.streamUid)
    }
    return this.fail(existing, 'ModerationBlocked')
  }

  private async tryMarkReady(
    record: VideoAssetRecord,
    playlistUrl: string,
  ): Promise<VideoAssetRecord> {
    const ready = await this.readiness.isReady(playlistUrl)
    if (!ready) {
      return this.store.put({
        ...record,
        state: 'processing',
        streamUid: record.streamUid,
        playlistUrl: undefined,
        updatedAt: this.now(),
      })
    }
    return this.store.put({
      ...record,
      state: 'ready',
      playlistUrl,
      error: undefined,
      updatedAt: this.now(),
    })
  }

  private fail(
    record: VideoAssetRecord,
    error: VideoFailureCategory,
  ): Promise<VideoAssetRecord> {
    return this.store.put({
      ...record,
      state: 'failed',
      playlistUrl: undefined,
      error,
      updatedAt: this.now(),
    })
  }
}
