import { MINUTE } from '@atproto/common'
import { dbLogger } from '../logger'
import Database from '../db'
import { Snapshot } from '../mod-service/snapshot'

export class SnapshotCleaner {
  destroyed = false
  removalPromise: Promise<void> = Promise.resolve()
  timer?: NodeJS.Timeout

  constructor(
    private db: Database,
    private expiration: number,
  ) {}

  start() {
    this.poll()
  }

  poll() {
    if (this.destroyed) return
    this.removalPromise = this.removeExpiredSnapshots()
      .catch((err) => dbLogger.error({ err }, 'snapshot cleaner error'))
      .finally(() => {
        this.timer = setTimeout(() => this.poll(), getInterval())
      })
  }

  async destroy() {
    this.destroyed = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    await this.removalPromise
  }

  async removeExpiredSnapshots() {
    await this.db.transaction(async (txn) => {
      const snapshotService = new Snapshot(txn)
      const expiration = new Date(Date.now() - this.expiration)
      return snapshotService.removeExpiredSnapshots(expiration)
    })
  }
}

const getInterval = (): number => {
  // super basic synchronization by agreeing when the intervals land relative to unix timestamp
  const now = Date.now()
  const intervalMs = MINUTE
  const nextIteration = Math.ceil(now / intervalMs)
  return nextIteration * intervalMs - now
}
