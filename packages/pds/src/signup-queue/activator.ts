import { SECOND, jitter, wait } from '@atproto/common'
import { limiterLogger as log } from '../logger'
import Database from '../db'
import { Leader } from '../db/leader'
import { DisconnectError } from '@atproto/xrpc-server'
import { getQueueStatus } from './util'

type LimiterFlags = {
  disableSignups: boolean
  periodAllowance: number
  periodMs: number
}

type LimiterStatus = LimiterFlags & {
  accountsInPeriod: number
}

export const ACCOUNT_ACTIVATOR_ID = 1010

export class SignupActivator {
  leader: Leader

  destroyed = false
  promise: Promise<void> = Promise.resolve()
  timer: NodeJS.Timer | undefined
  status: LimiterStatus

  constructor(private db: Database, lockId = ACCOUNT_ACTIVATOR_ID) {
    this.leader = new Leader(lockId, this.db)
  }

  async run() {
    while (!this.destroyed)
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          this.poll()
          await new Promise<void>((resolve, reject) => {
            signal.addEventListener('abort', () => {
              const err = signal.reason
              if (!err || err instanceof DisconnectError) {
                resolve()
              } else {
                reject(err)
              }
            })
          })
        })
        if (ran && !this.destroyed) {
          throw new Error(
            'Account activator leader completed, but should be persistent',
          )
        }
      } catch (err) {
        log.error({ err }, 'account activator errored')
      } finally {
        if (!this.destroyed) {
          await wait(1000 + jitter(500))
        }
      }
  }

  poll() {
    if (this.destroyed) return
    this.promise = this.activateBatch()
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
    this.leader.destroy(new DisconnectError())
    await this.promise
  }

  async activateBatch() {
    const status = await getQueueStatus(this.db)
    const toAdmit = status.periodAllowance - status.accountsInPeriod
    log.info({ ...status, toAdmit }, 'activating accounts')

    if (status.disableSignups) return
    if (toAdmit < 1) return

    const activatedAt = new Date().toISOString()
    const activated = await this.db.db
      .updateTable('user_account')
      .set({ activatedAt })
      .where('did', 'in', (qb) =>
        qb
          .selectFrom('user_account')
          .select('did')
          .where('activatedAt', 'is', null)
          .orderBy('createdAt', 'asc')
          .limit(toAdmit),
      )
      .returning('did')
      .execute()

    log.info({ count: activated.length }, 'activated accounts')
    // @TODO send mail/push notifs
  }
}
