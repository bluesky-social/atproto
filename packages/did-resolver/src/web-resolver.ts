import axios, { AxiosError } from 'axios'
import BaseResolver from './base-resolver'
import { WebResolverOpts } from './types'
import { PoorlyFormattedDidError } from './errors'
import { DidCache } from './did-cache'

export const DOC_PATH = '/.well-known/did.json'

export class DidWebResolver extends BaseResolver {
  constructor(public opts: WebResolverOpts, public cache?: DidCache) {
    super(cache)
  }

  async resolveDidNoCheck(did: string): Promise<unknown> {
    const parsedId = did.split(':').slice(2).join(':')
    const parts = parsedId.split(':').map(decodeURIComponent)
    let path: string
    if (parts.length < 1) {
      throw new PoorlyFormattedDidError(did)
    } else if (parts.length === 1) {
      path = parts[0] + DOC_PATH
    } else {
      path = parts.join('/') + '/did.json'
    }

    const url = new URL(`https://${path}`)
    if (url.hostname === 'localhost') {
      url.protocol = 'http'
    }

    try {
      const res = await axios.get(url.toString(), {
        responseType: 'json',
        timeout: this.opts.timeout,
      })
      return res.data
    } catch (err) {
      if (err instanceof AxiosError && err.response) {
        return null // Positively not found, versus due to e.g. network error
      }
      throw err
    }
  }
}
