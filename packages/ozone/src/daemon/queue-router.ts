import { MINUTE } from '@atproto/common'
import { Database } from '../db'
import { dbLogger } from '../logger'
import { QueueServiceCreator } from '../queue/service'
import { getJobCursor, initJobCursor, updateJobCursor } from './job-cursor'

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
    await initJobCursor(this.db, JOB_NAME)
  }

  async getCursor(): Promise<number | null> {
    const cursor = await getJobCursor(this.db, JOB_NAME)
    return cursor ? parseInt(cursor, 10) : null
  }

  async updateCursor(lastId: number): Promise<void> {
    await updateJobCursor(this.db, JOB_NAME, String(lastId))
  }

  async routeReports() {
    const queueService = this.queueServiceCreator(this.db)
    const lastId = await this.getCursor()

    const result = await queueService.assignReportBatch({
      cursor: lastId,
      limit: BATCH_SIZE,
    })

    if (result.processed === 0) {
      dbLogger.info('no unassigned reports to route')
      return
    }

    await this.updateCursor(result.maxId)

    dbLogger.info(
      {
        processed: result.processed,
        assigned: result.assigned,
        unmatched: result.unmatched,
      },
      'queue routing completed',
    )
  }
}

// Poll every 5 minutes
const getInterval = (): number => 5 * MINUTE
