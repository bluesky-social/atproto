import { SECOND } from '@atproto/common'
import { limiterLogger as log } from '../logger'
import Database from '../db'
import { LimiterFlags, getAccountsInPeriod, getQueueStatus } from './util'

export class SignupLimiter {
  destroyed = false
  promise: Promise<void> = Promise.resolve()
  timer: NodeJS.Timer | undefined
  flags: LimiterFlags

  constructor(private db: Database) {}

  async hasAvailability(): Promise<boolean> {
    if (this.flags.disableSignups) return false
    const accountsInPeriod = await this.accountsInPeriod()
    return accountsInPeriod < this.flags.periodAllowance
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

  async accountsInPeriod(): Promise<number> {
    return getAccountsInPeriod(this.db, this.flags.periodMs)
  }

  async refresh() {
    this.flags = await getQueueStatus(this.db)

    log.info({ ...this.flags }, 'limiter refresh')
  }
}
