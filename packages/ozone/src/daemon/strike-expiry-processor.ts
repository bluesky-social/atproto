import { createHash } from 'node:crypto'
import { MINUTE, SECOND } from '@atproto/common'
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
  hash: string
  after: DidString | null
  upper: DidString | null
  complete: boolean
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
    let interval = MINUTE
    this.processingPromise = this.processExpiredStrikes()
      .then((more) => {
        if (more) interval = SECOND
      })
      .catch((err) =>
        dbLogger.error({ err }, 'strike expiry processing errored'),
      )
      .finally(() => {
        if (!this.destroyed)
          this.timer = setTimeout(() => this.poll(), interval)
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
    const more = await this.processPolicyBatch()
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

  /** Commit bounded DID batches; policy edits restart the sweep without resetting the expiry cursor. */
  async processPolicyBatch(): Promise<boolean> {
    await initJobCursor(this.db, POLICY_JOB_NAME)
    return this.db.transaction(async (txn) => {
      const row = await txn.db
        .selectFrom('job_cursor')
        .select('cursor')
        .where('job', '=', POLICY_JOB_NAME)
        .forUpdate()
        .executeTakeFirstOrThrow()
      const service = this.strikeServiceCreator(txn)
      const { policy, revision } = await service.getExpiryPolicyState()
      const hash = createHash('sha256')
        .update(
          JSON.stringify({
            revision,
            policy: Object.entries(policy).sort(([a], [b]) =>
              a.localeCompare(b),
            ),
          }),
        )
        .digest('hex')
      let cursor: PolicyCursor | null = row.cursor
        ? JSON.parse(row.cursor)
        : null
      if (cursor?.hash !== hash) {
        const last = await txn.db
          .selectFrom('account_strike')
          .select('did')
          .orderBy('did', 'desc')
          .limit(1)
          .executeTakeFirst()
        cursor = {
          hash,
          after: null,
          upper: last?.did ?? null,
          complete: false,
        }
      }
      if (cursor.complete) return false
      let query = txn.db.selectFrom('account_strike').select('did')
      if (cursor.after) query = query.where('did', '>', cursor.after)
      const subjects = cursor.upper
        ? await query
            .where('did', '<=', cursor.upper)
            .orderBy('did', 'asc')
            .limit(POLICY_BATCH_SIZE)
            .execute()
        : []
      let changed = 0
      const now = toDatetimeString(new Date())
      for (const { did } of subjects) {
        await service.lockSubject(did)
        const notifications = new InboxNotificationService(
          txn,
          this.strikeSuspension,
          this.inboxStartAt,
        )
        const before = await notifications.captureStanding(did)
        changed += await service.reconcileSubjectExpiry(did, policy)
        await notifications.notifyStandingChange(
          did,
          before,
          `strike-policy:${hash}:${did}:${now}`,
          now,
        )
      }
      cursor.after = subjects.at(-1)?.did ?? cursor.after
      cursor.complete = subjects.length < POLICY_BATCH_SIZE
      await updateJobCursor(txn, POLICY_JOB_NAME, JSON.stringify(cursor))
      dbLogger.info(
        { subjects: subjects.length, changed, complete: cursor.complete },
        'strike expiry policy batch completed',
      )
      return !cursor.complete
    })
  }
}
