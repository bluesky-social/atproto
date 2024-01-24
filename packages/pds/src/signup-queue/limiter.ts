import { SECOND } from '@atproto/common'
import { limiterLogger as log } from '../logger'
import Database from '../db'
import { LimiterStatus, getQueueStatus } from './util'

export class SignupLimiter {
  destroyed = false
  promise: Promise<void> = Promise.resolve()
  timer: NodeJS.Timer | undefined
  status: LimiterStatus

  constructor(private db: Database) {}

  hasAvailability(): boolean {
    if (this.status.disableSignups) return false
    return this.status.accountsInPeriod < this.status.periodAllowance
  }

  async start() {
    this.poll()
    await this.promise
  }

  poll() {
    if (this.destroyed) return
    this.promise = this.refresh()
      .catch((err) => log.error({ err }, 'limiter refresh failed'))
      .finally(() => {
        this.timer = setTimeout(() => this.poll(), 30 * SECOND)
      })
  }

  async destroy() {
    this.destroyed = true
    if (this.timer) {
      clearTimeout(this.timer)
    }
    await this.promise
  }

  async refresh() {
    this.status = await getQueueStatus(this.db)

    log.info({ ...this.status }, 'limiter refresh')
  }
}
