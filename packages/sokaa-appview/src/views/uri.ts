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

  videoPlaylist(did: string, videoCid: string) {
    return this.media(did, videoCid)
  }

  videoThumbnail(did: string, videoCid: string) {
    return this.media(did, videoCid)
  }

  private media(did: string, cid: string) {
    return `${this.opts.cdnUrl}/v1/media/${encodeURIComponent(did)}/${encodeURIComponent(cid)}`
  }
}
