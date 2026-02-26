import { HOUR } from '@atproto/common'
import { Database } from '../db'
import { dbLogger } from '../logger'
import { StrikeServiceCreator } from '../mod-service/strike'
import { getJobCursor, initJobCursor, updateJobCursor } from './job-cursor'

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

  async getCursor(): Promise<string | null> {
    return getJobCursor(this.db, JOB_NAME)
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
      await this.updateCursor(now.toISOString())
      return
    }

    dbLogger.info(
      { count: affectedSubjects.length },
      'processing subjects with expired strikes',
    )

    await Promise.all(
      affectedSubjects.map(({ subjectDid }) => {
        return strikeService.updateSubjectStrikeCount(subjectDid)
      }),
    )

    await this.updateCursor(now.toISOString())

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
