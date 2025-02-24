import { BskyAppView } from '../bsky-app-view'
import { ids } from '../lexicon/lexicons'

export class ImageUrlBuilder {
  constructor(
    readonly pdsHostname: string,
    readonly bskyAppView?: BskyAppView,
  ) {}

  build(pattern: string, did: string, cid: string): string {
    return (
      this.bskyAppView?.getImageUrl(pattern, did, cid) ??
      `https://${this.pdsHostname}/xrpc/${ids.ComAtprotoSyncGetBlob}?did=${did}&cid=${cid}`
    )
  }
}
