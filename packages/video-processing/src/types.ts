export type VideoProcessingState = 'processing' | 'ready' | 'failed'

export type VideoFailureCategory =
  | 'InvalidSource'
  | 'TranscodeFailed'
  | 'Timeout'
  | 'ModerationBlocked'
  | 'Unavailable'

export type VideoAssetRecord = {
  did: string
  videoCid: string
  state: VideoProcessingState
  streamUid?: string
  playlistUrl?: string
  error?: VideoFailureCategory
  attempts: number
  updatedAt: string
}

export type SubmitJobInput = {
  did: string
  videoCid: string
  /** Authenticated URL the Stream copy API can fetch (e.g. media gateway). */
  sourceUrl: string
}

export type StreamUploadResult = {
  uid: string
  /** Present when Stream already finished encoding. */
  playbackUrl?: string
}

export interface StreamClient {
  copyFromUrl(input: {
    url: string
    meta: { did: string; videoCid: string }
  }): Promise<StreamUploadResult>
  getPlaybackUrl(uid: string): string
  delete(uid: string): Promise<void>
}

export interface AssetStore {
  get(did: string, videoCid: string): Promise<VideoAssetRecord | undefined>
  put(record: VideoAssetRecord): Promise<VideoAssetRecord>
}

export interface ReadinessChecker {
  /** True when master playlist (and ideally first segment) is retrievable. */
  isReady(playlistUrl: string): Promise<boolean>
}

export const MAX_ATTEMPTS = 5

export function jobKey(did: string, videoCid: string): string {
  return `${did}/${videoCid}`
}

export function isRetryableFailure(category: VideoFailureCategory): boolean {
  return category === 'Timeout' || category === 'Unavailable'
}

export function classifyStreamError(err: unknown): VideoFailureCategory {
  const message = err instanceof Error ? err.message : String(err)
  if (/unsupported|invalid|corrupt|codec/i.test(message)) {
    return 'InvalidSource'
  }
  if (/timeout|timed out/i.test(message)) {
    return 'Timeout'
  }
  if (/moderat|takedown|blocked|forbidden/i.test(message)) {
    return 'ModerationBlocked'
  }
  if (/5\d\d|unavailable|ECONNRESET|fetch failed/i.test(message)) {
    return 'Unavailable'
  }
  return 'TranscodeFailed'
}
