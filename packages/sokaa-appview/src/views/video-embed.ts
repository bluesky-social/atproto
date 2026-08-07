import * as AppSokaaEmbedVideo from '../lexicon/types/app/sokaa/embed/video'
import { CdnUriBuilder } from './uri'

export type VideoAssetHydration = {
  state: 'processing' | 'ready' | 'failed'
  playlistUrl?: string | null
  error?: string | null
}

/**
 * Build a hydrated video embed view.
 * Hard rule: never emit a playable playlist unless state is ready and a
 * playlist URL is present (AppView must not treat raw MP4 as HLS readiness).
 */
export function buildVideoEmbedView(opts: {
  authorDid: string
  videoCid: string
  thumbCid?: string
  alt?: string
  duration?: number
  aspectRatio?: AppSokaaEmbedVideo.AspectRatio
  asset?: VideoAssetHydration | null
  cdn: CdnUriBuilder
}): AppSokaaEmbedVideo.View {
  const state = opts.asset?.state ?? 'processing'
  const playlist =
    state === 'ready' && opts.asset?.playlistUrl
      ? opts.asset.playlistUrl
      : undefined

  return {
    $type: 'app.sokaa.embed.video#view',
    cid: opts.videoCid,
    state,
    ...(playlist ? { playlist } : {}),
    thumbnail: opts.thumbCid
      ? opts.cdn.videoThumbnail(opts.authorDid, opts.thumbCid)
      : undefined,
    alt: opts.alt,
    duration: opts.duration,
    aspectRatio: opts.aspectRatio,
    ...(state === 'failed' && opts.asset?.error
      ? { error: opts.asset.error as AppSokaaEmbedVideo.View['error'] }
      : {}),
  }
}

export function videoAssetKey(did: string, videoCid: string): string {
  return `${did}/${videoCid}`
}
