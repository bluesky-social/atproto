import { wait } from '@atproto/common'
import { randomIntFromSeed } from '@atproto/crypto'
import { LRUCache } from 'lru-cache'
import Database from './db'
import { dbLogger as log } from './logger'

type AppviewProxyFlagName = `appview-proxy:${string}`

export type FlagName = AppviewProxyFlagName

export class RuntimeFlags {
  destroyed = false
  private flags = new Map<string, string>()
  public appviewProxy = new AppviewProxyFlags(this)

  constructor(public db: Database) {}

  async start() {
    await this.refresh()
    this.poll()
  }

  destroy() {
    this.destroyed = true
  }

  get(flag: FlagName) {
    return this.flags.get(flag) || null
  }

  async refresh() {
    const flags = await this.db.db
      .selectFrom('runtime_flag')
      .selectAll()
      .execute()
    this.flags = new Map()
    for (const flag of flags) {
      this.flags.set(flag.name, flag.value)
    }
  }

  async poll() {
    try {
      if (this.destroyed) return
      await this.refresh()
    } catch (err) {
      log.error({ err }, 'runtime flags failed to refresh')
    }
    await wait(5000)
    this.poll()
  }
}

class AppviewProxyFlags {
  private partitionCache = new LRUCache({
    max: 50000,
    fetchMethod(did: string) {
      return randomIntFromSeed(did, 10)
    },
  })

  constructor(private runtimeFlags: RuntimeFlags) {}

  async shouldProxy(endpoint: string, did?: string) {
    const val = this.runtimeFlags.get(`appview-proxy:${endpoint}`) || '0'
    const threshold = parseInt(val, 10)
    if (threshold === 0 || !appviewFlagIsValid(threshold)) {
      return false
    }
    if (threshold === 10) {
      return true
    }
    if (!did) {
      return false
    }
    // threshold is 0 to 10 inclusive, partitions are 0 to 9 inclusive.
    const partition = await this.partitionCache.fetch(did)
    return partition !== undefined && partition < threshold
  }
}

const appviewFlagIsValid = (val: number) => {
  return 0 <= val && val <= 10
}
