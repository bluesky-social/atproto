import { HOUR } from '@atproto/common'
import { type DatetimeString, toDatetimeString } from '@atproto/lex'
import type { Database } from '../db/index.js'
import { createInboxNotification } from '../inbox/notifications.js'
import { getInboxStanding } from '../inbox/standing.js'
import { dbLogger } from '../logger.js'
import type { StrikeServiceCreator } from '../mod-service/strike.js'
import { getJobCursor, initJobCursor, updateJobCursor } from './job-cursor.js'

const JOB_NAME = 'strike_expiry'

export class StrikeExpiryProcessor {
  destroyed = false
  processingPromise: Promise<void> = Promise.resolve()
  timer?: NodeJS.Timeout

  constructor(
    private db: Database,
    private strikeServiceCreator: StrikeServiceCreator,
  ) {}

  start() {
    this.initializeCursor().then(() => this.poll())
  }

  poll() {
    if (this.destroyed) return
    this.processingPromise = this.processExpiredStrikes()
      .catch((err) =>
        dbLogger.error({ err }, 'strike expiry processing errored'),
      )
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
    await this.processingPromise
  }

  async initializeCursor() {
    await initJobCursor(this.db, JOB_NAME)
  }

  async getCursor(): Promise<DatetimeString | null> {
    return (await getJobCursor(this.db, JOB_NAME)) as DatetimeString | null
  }

  async updateCursor(cursor: string): Promise<void> {
    await updateJobCursor(this.db, JOB_NAME, cursor)
  }

  async processExpiredStrikes() {
    const now = new Date()
    const strikeService = this.strikeServiceCreator(this.db)
    const lastProcessedAt = await this.getCursor()
    const affectedSubjects = await strikeService.getExpiredStrikeSubjects(
      lastProcessedAt || undefined,
    )

    if (!affectedSubjects.length) {
      dbLogger.info('no expired strikes to process')
      await this.updateCursor(toDatetimeString(now))
      return
    }

    dbLogger.info(
      { count: affectedSubjects.length },
      'processing subjects with expired strikes',
    )

    for (const { subjectDid } of affectedSubjects) {
      await this.db.transaction(async (txn) => {
        const before = await getInboxStanding(txn, subjectDid)
        await this.strikeServiceCreator(txn).updateSubjectStrikeCount(
          subjectDid,
        )
        const standing = await getInboxStanding(txn, subjectDid)
        if (standing !== before) {
          await createInboxNotification(txn, {
            recipientDid: subjectDid,
            reason: 'standingChanged',
            target: {
              $type: 'tools.ozone.inbox.defs#standingRef',
              standing,
              previousStanding: before,
            },
            sourceKey: `strike-expiry:${subjectDid}:${now.toISOString()}`,
            createdAt: toDatetimeString(now),
          })
        }
      })
    }

    await this.updateCursor(toDatetimeString(now))

    dbLogger.info(
      { processed: affectedSubjects.length },
      'strike expiry processing completed',
    )
  }
}

const getInterval = (): number => {
  // Run every hour, synchronized to the hour boundary
  const now = Date.now()
  const intervalMs = HOUR
  const nextIteration = Math.ceil(now / intervalMs)
  return nextIteration * intervalMs - now
}
