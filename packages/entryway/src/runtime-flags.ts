import { BailableWait, bailableWait } from '@atproto/common'
import Database from './db'
import { dbLogger as log } from './logger'

export type FlagName = ''

export class RuntimeFlags {
  destroyed = false
  private flags = new Map<string, string>()
  private pollWait: BailableWait | undefined = undefined

  constructor(public db: Database) {}

  async start() {
    await this.refresh()
    this.poll()
  }

  async destroy() {
    this.destroyed = true
    this.pollWait?.bail()
    await this.pollWait?.wait()
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
    this.pollWait = bailableWait(5000)
    await this.pollWait.wait()
    this.poll()
  }
}
