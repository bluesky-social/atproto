import { isErrnoException } from '@atproto/common-web'
import dns from 'dns/promises'
import { HandleResolverOpts } from '../types'

const SUBDOMAIN = '_atproto'
const PREFIX = 'did='

export class HandleResolver {
  public timeout: number

  constructor(opts: HandleResolverOpts = {}) {
    this.timeout = opts.timeout ?? 3000
  }

  async resolve(handle: string): Promise<string | undefined> {
    const dnsPromise = this.resolveDns(handle)
    const httpAbort = new AbortController()
    const httpPromise = this.resolveHttp(handle, httpAbort.signal).catch(
      () => undefined,
    )
    const httpLegacyAbort = new AbortController()
    const httpPromiseLegacy = this.resolveHttpLegacy(
      handle,
      httpLegacyAbort.signal,
    ).catch(() => undefined)

    const dnsRes = await dnsPromise
    if (dnsRes) {
      httpAbort.abort()
      httpLegacyAbort.abort()
      return dnsRes
    }
    const httpRes = await httpPromise
    if (httpRes) {
      httpLegacyAbort.abort()
      return httpRes
    }
    return httpPromiseLegacy
  }

  async resolveDns(handle: string): Promise<string | undefined> {
    let chunkedResults: string[][]
    try {
      chunkedResults = await dns.resolveTxt(`${SUBDOMAIN}.${handle}`)
    } catch (err) {
      if (isErrnoException(err) && err.code === 'ENOTFOUND') {
        return undefined
      }
      throw err
    }
    const results = chunkedResults.map((chunks) => chunks.join(''))
    const found = results.filter((i) => i.startsWith(PREFIX))
    if (found.length !== 1) {
      return undefined
    }
    return found[0].slice(PREFIX.length)
  }

  async resolveHttp(
    handle: string,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    const url = new URL('/.well-known/atproto-did', `https://${handle}`)
    try {
      const res = await fetch(url, { signal })
      const did = await res.text()
      if (typeof did === 'string' && did.startsWith('did:')) {
        return did
      }
      return undefined
    } catch (err) {
      return undefined
    }
  }

  // DEPRECATED
  // @TODO remove
  async resolveHttpLegacy(
    handle: string,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    const url = new URL(
      `/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`,
      `https://${handle}`,
    )
    try {
      const res = await fetch(url, { signal })
      const data = await res.json()
      return typeof data?.did === 'string' ? data.did : undefined
    } catch (err) {
      return undefined
    }
  }
}
