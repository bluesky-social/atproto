import axios, { AxiosError } from 'axios'
import BaseResolver from './base-resolver'
import { DidCache } from '../types'
import { PoorlyFormattedDidError, UnsupportedDidWebPathError } from '../errors'

export const DOC_PATH = '/.well-known/did.json'

export class DidWebResolver extends BaseResolver {
  constructor(
    public timeout: number,
    public cache?: DidCache,
  ) {
    super(cache)
  }

  async resolveNoCheck(did: string): Promise<unknown> {
    const parsedId = did.split(':').slice(2).join(':')
    const parts = parsedId.split(':').map(decodeURIComponent)
    let path: string
    if (parts.length < 1) {
      throw new PoorlyFormattedDidError(did)
    } else if (parts.length === 1) {
      path = parts[0] + DOC_PATH
    } else {
      // how we *would* resolve a did:web with path, if atproto supported it
      //path = parts.join('/') + '/did.json'
      throw new UnsupportedDidWebPathError(did)
    }

    const url = new URL(`https://${path}`)
    if (url.hostname === 'localhost') {
      url.protocol = 'http'
    }

    try {
      const res = await axios.get(url.toString(), {
        responseType: 'json',
        timeout: this.timeout,
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
