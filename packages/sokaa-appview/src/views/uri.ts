import * as util from 'node:util'

export class CdnUriBuilder {
  constructor(
    private opts: {
      cdnUrl: string
      videoPlaylistUrlPattern: string
      videoThumbnailUrlPattern: string
    },
  ) {}

  avatar(did: string, cid: string) {
    return `${this.opts.cdnUrl}/avatar/plain/${did}/${cid}@jpeg`
  }

  banner(did: string, cid: string) {
    return `${this.opts.cdnUrl}/banner/plain/${did}/${cid}@jpeg`
  }

  feedThumbnail(did: string, cid: string) {
    return `${this.opts.cdnUrl}/img/feed_thumbnail/plain/${did}/${cid}@jpeg`
  }

  feedFullsize(did: string, cid: string) {
    return `${this.opts.cdnUrl}/img/feed_fullsize/plain/${did}/${cid}@jpeg`
  }

  videoPlaylist(did: string, videoCid: string) {
    return util.format(
      this.opts.videoPlaylistUrlPattern,
      encodeURIComponent(did),
      encodeURIComponent(videoCid),
    )
  }

  videoThumbnail(did: string, videoCid: string) {
    return util.format(
      this.opts.videoThumbnailUrlPattern,
      encodeURIComponent(did),
      encodeURIComponent(videoCid),
    )
  }
}
