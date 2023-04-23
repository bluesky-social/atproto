import axios, { AxiosError } from 'axios'
import BaseResolver from './base-resolver'
import { PlcResolverOpts } from './types'
import { DidCache } from './did-cache'

export class DidPlcResolver extends BaseResolver {
  constructor(public opts: PlcResolverOpts, public cache?: DidCache) {
    super(cache)
  }

  async resolveDidNoCheck(did: string): Promise<unknown> {
    try {
      const res = await axios.get(
        `${this.opts.plcUrl}/${encodeURIComponent(did)}`,
        {
          timeout: this.opts.timeout,
        },
      )
      return res.data
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 404) {
        return null // Positively not found, versus due to e.g. network error
      }
      throw err
    }
  }
}
