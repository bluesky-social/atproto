import { sql } from 'kysely'
import { HOUR, SECOND } from '@atproto/common'
import {
  type DatetimeString,
  type DidString,
  toDatetimeString,
} from '@atproto/lex'
import type { StrikeSuspensionConfig } from '../config/strike-suspension.js'
import type { Database } from '../db/index.js'
import { InboxNotificationService } from '../inbox/producers.js'
import { dbLogger } from '../logger.js'
import type { StrikeServiceCreator } from '../mod-service/strike.js'
import { getJobCursor, initJobCursor, updateJobCursor } from './job-cursor.js'

const JOB_NAME = 'strike_expiry'
const POLICY_JOB_NAME = 'strike_expiry_policy'
const POLICY_BATCH_SIZE = 50

type PolicyCursor = {
  days: number | null
  after: DidString | null
  upper: DidString | null
  complete: boolean
  checkedAt: number
}

export class StrikeExpiryProcessor {
  destroyed = false
  processingPromise: Promise<void> = Promise.resolve()
  timer?: NodeJS.Timeout

  constructor(
    private db: Database,
    private strikeServiceCreator: StrikeServiceCreator,
    private strikeSuspension: StrikeSuspensionConfig = {},
    private inboxStartAt?: DatetimeString,
  ) {}

  start() {
    this.initializeCursor().then(() => this.poll())
  }

  poll() {
    if (this.destroyed) return
    let more = false
    this.processingPromise = this.processExpiredStrikes()
      .then((pending) => {
        more = pending
      })
      .catch((err) =>
        dbLogger.error({ err }, 'strike expiry processing errored'),
      )
      .finally(() => {
        if (!this.destroyed)
          this.timer = setTimeout(
            () => this.poll(),
            more ? SECOND : getInterval(),
          )
      })
  }

  async destroy() {
    this.destroyed = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    await this.processingPromise
  }

  async initializeCursor() {
    await initJobCursor(this.db, JOB_NAME)
    await initJobCursor(this.db, POLICY_JOB_NAME)
  }

  async getCursor(): Promise<DatetimeString | null> {
    return (await getJobCursor(this.db, JOB_NAME)) as DatetimeString | null
  }

  async updateCursor(cursor: string): Promise<void> {
    await updateJobCursor(this.db, JOB_NAME, cursor)
  }

  async processExpiredStrikes() {
    // Policy failures must not stop ordinary time-based expiry.
    const more = await this.processPolicyBatch().catch((err) => {
      dbLogger.error({ err }, 'strike expiry policy processing errored')
      return false
    })
    const now = new Date()
    const strikeService = this.strikeServiceCreator(this.db)
    const lastProcessedAt = await this.getCursor()
    const affectedSubjects = await strikeService.getExpiredStrikeSubjects(
      lastProcessedAt || undefined,
    )

    if (!affectedSubjects.length) {
      dbLogger.info('no expired strikes to process')
      await this.updateCursor(toDatetimeString(now))
      return more
    }

    dbLogger.info(
      { count: affectedSubjects.length },
      'processing subjects with expired strikes',
    )

    for (const { subjectDid } of affectedSubjects) {
      await this.db.transaction(async (txn) => {
        const notifications = new InboxNotificationService(
          txn,
          this.strikeSuspension,
          this.inboxStartAt,
        )
        await this.strikeServiceCreator(txn).lockSubject(subjectDid)
        const before = await notifications.captureStanding(subjectDid)
        await this.strikeServiceCreator(txn).updateSubjectStrikeCount(
          subjectDid,
        )
        await notifications.notifyStandingChange(
          subjectDid,
          before,
          `strike-expiry:${subjectDid}:${now.toISOString()}`,
          toDatetimeString(now),
        )
      })
    }

    await this.updateCursor(toDatetimeString(now))

    dbLogger.info(
      { processed: affectedSubjects.length },
      'strike expiry processing completed',
    )
    return more
  }

  /** One account and its progress per transaction; hourly catch-up covers rolling deployments. */
  async processPolicyBatch(): Promise<boolean> {
    await initJobCursor(this.db, POLICY_JOB_NAME)
    for (let i = 0; i < POLICY_BATCH_SIZE; i++) {
      const more = await this.db.transaction(async (txn) => {
        await sql`set local lock_timeout = '5s'`.execute(txn.db)
        await sql`set local statement_timeout = '30s'`.execute(txn.db)
        const row = await txn.db
          .selectFrom('job_cursor')
          .select('cursor')
          .where('job', '=', POLICY_JOB_NAME)
          .forUpdate()
          .executeTakeFirstOrThrow()
        const service = this.strikeServiceCreator(txn)
        const days = service.expiryDays ?? null
        let cursor: PolicyCursor | null = row.cursor
          ? JSON.parse(row.cursor)
          : null
        if (
          !cursor ||
          cursor.days !== days ||
          (cursor.complete &&
            Math.floor(Date.now() / HOUR) > Math.floor(cursor.checkedAt / HOUR))
        ) {
          const last = await txn.db
            .selectFrom('account_strike')
            .select('did')
            .orderBy('did', 'desc')
            .limit(1)
            .executeTakeFirst()
          cursor = {
            days,
            after: null,
            upper: last?.did ?? null,
            complete: false,
            checkedAt: Date.now(),
          }
        }
        if (cursor.complete) return false
        let query = txn.db.selectFrom('account_strike').select('did')
        if (cursor.after) query = query.where('did', '>', cursor.after)
        const subject = cursor.upper
          ? await query
              .where('did', '<=', cursor.upper)
              .orderBy('did')
              .limit(1)
              .executeTakeFirst()
          : undefined
        if (subject) {
          await service.lockSubject(subject.did)
          const notifications = new InboxNotificationService(
            txn,
            this.strikeSuspension,
            this.inboxStartAt,
          )
          const before = await notifications.captureStanding(subject.did)
          await service.refreshSubjectExpiry(subject.did)
          const now = toDatetimeString(new Date())
          await notifications.notifyStandingChange(
            subject.did,
            before,
            `strike-policy:${days}:${subject.did}:${now}`,
            now,
          )
          cursor.after = subject.did
        } else {
          cursor.complete = true
          cursor.checkedAt = Date.now()
        }
        await updateJobCursor(txn, POLICY_JOB_NAME, JSON.stringify(cursor))
        return !cursor.complete
      })
      if (!more) return false
    }
    return true
  }
}

const getInterval = (): number => {
  // Run every hour, synchronized to the hour boundary
  const now = Date.now()
  const intervalMs = HOUR
  const nextIteration = Math.ceil(now / intervalMs)
  return nextIteration * intervalMs - now
}
