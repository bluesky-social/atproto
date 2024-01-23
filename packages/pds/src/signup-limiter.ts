import { SECOND } from '@atproto/common'
import { limiterLogger as log } from './logger'
import Database from './db'
import { countAll } from './db/util'

type LimiterFlags = {
  disableSignups: boolean
  periodAllowance: number
  periodMs: number
}

type LimiterStatus = LimiterFlags & {
  accountsInPeriod: number
}

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
    const flags = await this.getRuntimeFlags()
    const accountsInPeriod =
      flags.periodMs === 0 ? 0 : await this.accountsInPeriod(flags.periodMs)

    this.status = {
      ...flags,
      accountsInPeriod,
    }

    log.info({ ...this.status }, 'limiter refresh')
  }

  async getRuntimeFlags(): Promise<LimiterFlags> {
    const flagsRes = await this.db.db
      .selectFrom('runtime_flag')
      .selectAll()
      .where('name', '=', DISABLE_SIGNUPS_FLAG)
      .orWhere('name', '=', PERIOD_ALLOWANCE_FLAG)
      .orWhere('name', '=', PERIOD_MS_FLAG)
      .execute()
    const disableSignups =
      flagsRes.find((val) => val.name === DISABLE_SIGNUPS_FLAG)?.value ??
      'false'
    const periodAllowanceFlag =
      flagsRes.find((val) => val.name === PERIOD_ALLOWANCE_FLAG)?.value ??
      '10000000'
    const periodAllowance = parseInt(periodAllowanceFlag)
    const periodMsFlag =
      flagsRes.find((val) => val.name === PERIOD_MS_FLAG)?.value ?? '0'
    const periodMs = parseInt(periodMsFlag)

    return {
      disableSignups: disableSignups === 'true',
      periodAllowance: isNaN(periodAllowance) ? 10000000 : periodAllowance,
      periodMs: isNaN(periodMs) ? 10000000 : periodMs,
    }
  }

  async accountsInPeriod(period: number): Promise<number> {
    const hourAgo = new Date(Date.now() - period).toISOString()
    const res = await this.db.db
      .selectFrom('user_account')
      .select(countAll.as('count'))
      .where('createdAt', '>', hourAgo)
      .executeTakeFirstOrThrow()
    return res.count
  }
}

const DISABLE_SIGNUPS_FLAG = 'signup-limiter:disableSignups'
const PERIOD_ALLOWANCE_FLAG = 'signup-limiter:periodAllowance'
const PERIOD_MS_FLAG = 'signup-limiter:periodMs'
