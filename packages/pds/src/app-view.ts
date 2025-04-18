import { format } from 'node:util'
import { AtpAgent } from '@atproto/api'

export type AppViewOptions = {
  url: string
  did: string
  cdnUrlPattern?: string
}

export class AppView {
  public did: string
  public agent: AtpAgent
  private cdnUrlPattern?: string

  constructor(options: AppViewOptions) {
    this.did = options.did
    this.agent = new AtpAgent({ service: options.url })
    this.cdnUrlPattern = options.cdnUrlPattern
  }

  getImageUrl(pattern: string, did: string, cid: string): string | undefined {
    if (this.cdnUrlPattern) return format(this.cdnUrlPattern, pattern, did, cid)
  }
}
