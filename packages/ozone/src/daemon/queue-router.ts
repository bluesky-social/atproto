import { MINUTE } from '@atproto/common'
import { Database } from '../db'
import { dbLogger } from '../logger'
import { QueueServiceCreator } from '../queue/service'

const JOB_NAME = 'queue_router'
const BATCH_SIZE = 100

export class QueueRouter {
  destroyed = false
  processingPromise: Promise<void> = Promise.resolve()
  timer?: NodeJS.Timeout

  constructor(
    private db: Database,
    private queueServiceCreator: QueueServiceCreator,
  ) {}

  start() {
    this.initializeCursor().then(() => this.poll())
  }

  poll() {
    if (this.destroyed) return
    this.processingPromise = this.routeReports()
      .catch((err) => dbLogger.error({ err }, 'queue routing errored'))
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
    // Get latest event
    const latest = await this.db.db
      .selectFrom('moderation_event')
      .select('id')
      .orderBy('id', 'desc')
      .executeTakeFirst()
    const cursor = String(latest?.id ?? 0)
    dbLogger.info({ cursor }, 'initializing queue router cursor')

    // Initialize cursor row to last event ID
    // Conflict check ensures parallel safety
    await this.db.db
      .insertInto('job_cursor')
      .values({ job: JOB_NAME, cursor })
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async getCursor(): Promise<number | null> {
    const row = await this.db.db
      .selectFrom('job_cursor')
      .select('cursor')
      .where('job', '=', JOB_NAME)
      .executeTakeFirst()
    return row?.cursor ? parseInt(row.cursor, 10) : null
  }

  async routeReports() {
    await this.db.transaction(async (txn) => {
      // Acquire row lock on the job_cursor row. A second daemon instance
      // hitting this same query blocks here until the first transaction
      // commits, then reads the now-advanced cursor and processes the next
      // range. The lock is held for the whole batch (~50–200ms).
      const row = await txn.db
        .selectFrom('job_cursor')
        .selectAll()
        .where('job', '=', JOB_NAME)
        .forUpdate()
        .executeTakeFirst()
      if (!row) return
      const cursor = row.cursor ? parseInt(row.cursor, 10) : null

      const queueService = this.queueServiceCreator(txn)
      const result = await queueService.insertReportsFromEvents({
        cursor,
        limit: BATCH_SIZE,
      })

      if (result.processed === 0) {
        dbLogger.info({}, 'no new report events to route')
        return
      }

      await txn.db
        .updateTable('job_cursor')
        .set({ cursor: String(result.maxEventId) })
        .where('job', '=', JOB_NAME)
        .execute()

      dbLogger.info(
        {
          processed: result.processed,
          assigned: result.assigned,
          unmatched: result.unmatched,
          maxEventId: result.maxEventId,
        },
        'queue routing completed',
      )
    })
  }
}

// Poll every 1 minute
const getInterval = (): number => 1 * MINUTE
