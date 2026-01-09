import { format } from 'node:util'
import { Client } from '@atproto/lex'

export type AppViewOptions = {
  url: string
  did: string
  cdnUrlPattern?: string
}

export class BskyAppView {
  public did: string
  public url: string
  public client: Client
  private cdnUrlPattern?: string

  constructor(options: AppViewOptions) {
    this.did = options.did
    this.url = options.url
    this.client = new Client({ service: options.url })
    this.cdnUrlPattern = options.cdnUrlPattern
  }

  getImageUrl(pattern: string, did: string, cid: string): string | undefined {
    if (this.cdnUrlPattern) return format(this.cdnUrlPattern, pattern, did, cid)
  }
}
