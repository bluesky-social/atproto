import axios, { AxiosError } from 'axios'
import BaseResolver from './base-resolver'
import { DidCache } from '../types'

export class DidPlcResolver extends BaseResolver {
  constructor(
    public plcUrl: string,
    public timeout: number,
    public cache?: DidCache,
  ) {
    super(cache)
  }

  async resolveNoCheck(did: string): Promise<unknown> {
    try {
      const res = await axios.get(`${this.plcUrl}/${encodeURIComponent(did)}`, {
        timeout: this.timeout,
      })
      return res.data
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 404) {
        return null // Positively not found, versus due to e.g. network error
      }
      throw err
    }
  }
}
