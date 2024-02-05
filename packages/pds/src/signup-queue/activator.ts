import { RateLimiterAbstract } from 'rate-limiter-flexible'
import { SECOND, chunkArray, jitter, wait } from '@atproto/common'
import { DisconnectError } from '@atproto/xrpc-server'
import { Timestamp } from '@bufbuild/protobuf'
import { limiterLogger as log } from '../logger'
import Database from '../db'
import { Leader } from '../db/leader'
import { getQueueStatus } from './util'
import { ServerMailer } from '../mailer'
import { CourierClient } from '../courier'

type LimiterFlags = {
  disableSignups: boolean
  periodAllowance: number
  periodMs: number
}

type LimiterStatus = LimiterFlags & {
  accountsInPeriod: number
}

export const ACCOUNT_ACTIVATOR_ID = 1010

export type ActivatorOpts = {
  db: Database
  mailer?: ServerMailer
  courierClient?: CourierClient
  limiter?: RateLimiterAbstract
}

export class SignupActivator {
  leader: Leader

  db: Database
  mailer?: ServerMailer
  courierClient?: CourierClient
  limiter?: RateLimiterAbstract

  destroyed = false
  promise: Promise<void> = Promise.resolve()
  timer: NodeJS.Timer | undefined
  status: LimiterStatus

  constructor(opts: ActivatorOpts, lockId = ACCOUNT_ACTIVATOR_ID) {
    this.leader = new Leader(lockId, opts.db)
    this.db = opts.db
    this.mailer = opts.mailer
    this.courierClient = opts.courierClient
    this.limiter = opts.limiter
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

    const dids = activated.map((row) => row.did)
    await Promise.all([
      this.sendActivationEmails(dids),
      this.sendActivationPushNotifs(dids),
    ])
  }

  async sendActivationEmails(dids: string[]) {
    if (dids.length < 1 || !this.mailer) return
    const users = await this.db.db
      .selectFrom('user_account')
      .innerJoin('did_handle', 'did_handle.did', 'user_account.did')
      .where('did_handle.did', 'in', dids)
      .select(['user_account.email', 'did_handle.handle'])
      .execute()
    for (const chunk of chunkArray(users, 100)) {
      try {
        await this.limiter?.consume('server-mailer-limit', chunk.length)
      } catch (err) {
        log.error({ err }, 'user activation email rate limit exceeded')
      }
      try {
        await Promise.all(
          chunk.map(({ email, handle }) =>
            this.mailer?.sendAccountActivated({ handle }, { to: email }),
          ),
        )
      } catch (err) {
        log.error({ err, dids: chunk }, 'error sending activation emails')
      }
      await wait(SECOND)
    }
  }

  async sendActivationPushNotifs(dids: string[]) {
    if (dids.length < 1 || !this.courierClient) return
    for (const chunk of chunkArray(dids, 100)) {
      const notifications = chunk.map((did) => ({
        id: `${did}-account-activated`,
        recipientDid: did,
        title: 'Great news!',
        message: 'Your Bluesky account is ready to go',
        collapseKey: 'account-activated',
        alwaysDeliver: true,
        timestamp: Timestamp.fromDate(new Date()),
      }))
      try {
        await this.courierClient.pushNotifications({
          notifications,
        })
      } catch (err) {
        log.error({ err, dids: chunk }, 'error sending activation push notifs')
      }
    }
  }
}
