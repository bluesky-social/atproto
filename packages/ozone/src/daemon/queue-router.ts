import { Selectable } from 'kysely'
import { MINUTE } from '@atproto/common'
import { AtUri } from '@atproto/syntax'
import { Database } from '../db'
import { ReportQueue } from '../db/schema/report_queue'
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
    const { queues } = await queueService.list({ limit: 1000, enabled: true })

    if (!queues.length) {
      dbLogger.info('no queues configured, skipping queue routing')
      return
    }

    const lastId = await this.getCursor()

    let query = this.db.db
      .selectFrom('report as r')
      .innerJoin('moderation_event as me', 'me.id', 'r.eventId')
      .where('r.queueId', 'is', null)
      .select(['r.id', 'me.subjectUri', 'me.subjectMessageId', 'me.meta'])
      .orderBy('r.id', 'asc')
      .limit(BATCH_SIZE)

    if (lastId !== null) {
      query = query.where('r.id', '>', lastId)
    }

    const reports = await query.execute()

    if (!reports.length) {
      dbLogger.info('no unassigned reports to route')
      return
    }

    const now = new Date().toISOString()
    let assigned = 0
    let unmatched = 0
    let maxId = 0

    for (const report of reports) {
      const subjectType = report.subjectMessageId
        ? 'message'
        : report.subjectUri
          ? 'record'
          : 'account'

      let collection: string | null = null
      if (report.subjectUri) {
        try {
          collection = new AtUri(report.subjectUri).collection || null
        } catch {
          collection = null
        }
      }

      const reportType = (report.meta as Record<string, unknown> | null)
        ?.reportType as string | undefined

      const matchingQueue = findMatchingQueue(
        queues,
        subjectType,
        collection,
        reportType,
      )

      await this.db.db
        .updateTable('report')
        .set({
          queueId: matchingQueue?.id ?? -1,
          queuedAt: matchingQueue ? now : null,
          updatedAt: now,
        })
        .where('id', '=', report.id)
        .execute()

      if (matchingQueue) {
        assigned++
      } else {
        unmatched++
      }

      if (report.id > maxId) maxId = report.id
    }

    await this.updateCursor(maxId)

    dbLogger.info(
      { processed: reports.length, assigned, unmatched },
      'queue routing completed',
    )
  }
}

function findMatchingQueue(
  queues: Selectable<ReportQueue>[],
  subjectType: string,
  collection: string | null,
  reportType: string | undefined,
): Selectable<ReportQueue> | null {
  if (!reportType) return null

  for (const queue of queues) {
    const subjectTypeMatch = queue.subjectTypes.includes(subjectType)
    const collectionMatch = (collection ?? null) === queue.collection
    const reportTypeMatch = queue.reportTypes.includes(reportType)

    if (subjectTypeMatch && collectionMatch && reportTypeMatch) {
      return queue
    }
  }

  return null
}

// Poll every 5 minutes
const getInterval = (): number => 5 * MINUTE
