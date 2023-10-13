import dns from 'dns/promises'
import { HandleResolverOpts } from '../types'

const SUBDOMAIN = '_atproto'
const PREFIX = 'did='

export class HandleResolver {
  public timeout: number
  private backupNameservers: string[] | undefined
  private backupNameserverIps: string[] | undefined

  constructor(opts: HandleResolverOpts = {}) {
    this.timeout = opts.timeout ?? 3000
    this.backupNameservers = opts.backupNameservers
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
    return this.resolveDnsBackup(handle)
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
      const did = (await res.text()).split('\n')[0].trim()
      if (typeof did === 'string' && did.startsWith('did:')) {
        return did
      }
      return undefined
    } catch (err) {
      return undefined
    }
  }

  async resolveDnsBackup(handle: string): Promise<string | undefined> {
    let chunkedResults: string[][]
    try {
      const backupIps = await this.getBackupNameserverIps()
      if (!backupIps || backupIps.length < 1) return undefined
      const resolver = new dns.Resolver()
      resolver.setServers(backupIps)
      chunkedResults = await resolver.resolveTxt(`${SUBDOMAIN}.${handle}`)
    } catch (err) {
      return undefined
    }
    return this.parseDnsResult(chunkedResults)
  }

  parseDnsResult(chunkedResults: string[][]): string | undefined {
    const results = chunkedResults.map((chunks) => chunks.join(''))
    const found = results.filter((i) => i.startsWith(PREFIX))
    if (found.length !== 1) {
      return undefined
    }
    return found[0].slice(PREFIX.length)
  }

  private async getBackupNameserverIps(): Promise<string[] | undefined> {
    if (!this.backupNameservers) {
      return undefined
    } else if (!this.backupNameserverIps) {
      const responses = await Promise.allSettled(
        this.backupNameservers.map((h) => dns.lookup(h)),
      )
      for (const res of responses) {
        if (res.status === 'fulfilled') {
          this.backupNameserverIps ??= []
          this.backupNameserverIps.push(res.value.address)
        }
      }
    }
    return this.backupNameserverIps
  }
}
