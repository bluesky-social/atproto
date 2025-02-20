import { AppView } from '../app-view'
import { ids } from '../lexicon/lexicons'

export class ImageUrlBuilder {
  constructor(
    readonly pdsHostname: string,
    readonly appview?: AppView,
  ) {}

  build(pattern: string, did: string, cid: string): string {
    return (
      this.appview?.getImageUrl(pattern, did, cid) ??
      `https://${this.pdsHostname}/xrpc/${ids.ComAtprotoSyncGetBlob}?did=${did}&cid=${cid}`
    )
  }
}
