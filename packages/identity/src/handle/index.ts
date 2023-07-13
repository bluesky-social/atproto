import dns from 'dns/promises'
import { HandleResolverOpts } from '../types'

const SUBDOMAIN = '_atproto'
const PREFIX = 'did='

export class HandleResolver {
  public timeout: number
  private backupResolverHost: string | undefined

  constructor(opts: HandleResolverOpts = {}) {
    this.timeout = opts.timeout ?? 3000
    this.backupResolverHost = opts.backupResolverHost
  }

  async resolve(handle: string): Promise<string | undefined> {
    const dnsPromise = this.resolveDns(handle)
    const httpAbort = new AbortController()
    const httpPromise = this.resolveHttp(handle, httpAbort.signal).catch(
      () => undefined,
    )

    const dnsRes = await dnsPromise
    if (dnsRes) {
      httpAbort.abort()
      return dnsRes
    }
    const res = await httpPromise
    if (res) {
      return res
    }
    return this.resolveBackup(handle)
  }

  async resolveDns(handle: string): Promise<string | undefined> {
    let chunkedResults: string[][]
    try {
      chunkedResults = await dns.resolveTxt(`${SUBDOMAIN}.${handle}`)
    } catch (err) {
      return undefined
    }
    return this.parseDnsResult(chunkedResults)
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

  async resolveBackup(handle: string): Promise<string | undefined> {
    if (!this.backupResolverHost) return undefined
    const url = new URL(
      '/xrpc/com.atproto.identity.resolveHandle',
      `https://${this.backupResolverHost}`,
    )
    url.searchParams.set('handle', handle)
    try {
      const res = await fetch(url)
      const resp = await res.json()
      const did = resp?.did
      if (typeof did === 'string' && did.startsWith('did:')) {
        return did
      }
      return undefined
    } catch (err) {
      return undefined
    }
  }

  parseDnsResult(chunkedResults: string[][]): string | undefined {
    const results = chunkedResults.map((chunks) => chunks.join(''))
    const found = results.filter((i) => i.startsWith(PREFIX))
    if (found.length !== 1) {
      return undefined
    }
    return found[0].slice(PREFIX.length)
  }
}
