export class CdnUriBuilder {
  constructor(
    private opts: {
      cdnUrl: string
      /** @deprecated Raw video is served by the media gateway. */
      videoPlaylistUrlPattern: string
      /** @deprecated Thumbnails are served by the media gateway. */
      videoThumbnailUrlPattern: string
    },
  ) {}

  avatar(did: string, cid: string) {
    return this.media(did, cid)
  }

  banner(did: string, cid: string) {
    return this.media(did, cid)
  }

  feedThumbnail(did: string, cid: string) {
    return this.media(did, cid)
  }

  feedFullsize(did: string, cid: string) {
    return this.media(did, cid)
  }

  /**
   * @deprecated Raw MP4 gateway URLs must not be used as HLS playlist.
   * Prefer Stream playback URLs stored on `video_asset.playlistUrl`.
   */
  videoPlaylist(did: string, videoCid: string) {
    return this.media(did, videoCid)
  }

  videoThumbnail(did: string, videoCid: string) {
    return this.media(did, videoCid)
  }

  /** Mirrored HLS master under private R2 via the media gateway. */
  videoHlsMaster(did: string, videoCid: string) {
    return `${this.opts.cdnUrl}/v1/hls/${encodeURIComponent(did)}/${encodeURIComponent(videoCid)}/master.m3u8`
  }

  private media(did: string, cid: string) {
    return `${this.opts.cdnUrl}/v1/media/${encodeURIComponent(did)}/${encodeURIComponent(cid)}`
  }
}
