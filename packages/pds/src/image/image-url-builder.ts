import { BskyAppView } from '../bsky-app-view'
import { com } from '../lexicons/index.js'

export class ImageUrlBuilder {
  constructor(
    readonly pdsHostname: string,
    readonly bskyAppView?: BskyAppView,
  ) {}

  build(pattern: string, did: string, cid: string): string {
    return (
      this.bskyAppView?.getImageUrl(pattern, did, cid) ??
      `https://${this.pdsHostname}/xrpc/${com.atproto.sync.getBlob.$lxm}?did=${did}&cid=${cid}`
    )
  }
}
