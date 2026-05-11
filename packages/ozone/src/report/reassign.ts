import { InvalidRequestError } from '@atproto/xrpc-server'
import { Database } from '../db'
import { QueueService } from '../queue/service'

export type ReassignReportQueueParams = {
  reportId: number
  toQueueId: number
  comment?: string
  createdBy: string
}

export async function reassignReportQueue(
  db: Database,
  queueService: QueueService,
  params: ReassignReportQueueParams,
): Promise<void> {
  const { reportId, toQueueId, comment, createdBy } = params

  if (toQueueId !== -1) {
    const queue = await queueService.getById(toQueueId)
    if (!queue) {
      throw new InvalidRequestError(
        `Queue ${toQueueId} not found`,
        'QueueNotFound',
      )
    }
    if (!queue.enabled) {
      throw new InvalidRequestError(
        `Queue ${toQueueId} is disabled`,
        'QueueDisabled',
      )
    }
  }

  await db.transaction(async (dbTxn) => {
    const report = await dbTxn.db
      .selectFrom('report')
      .select(['id', 'status', 'queueId'])
      .where('id', '=', reportId)
      .forUpdate()
      .executeTakeFirst()

    if (!report) {
      throw new InvalidRequestError(
        `Report ${reportId} not found`,
        'ReportNotFound',
      )
    }

    if (report.status === 'closed') {
      throw new InvalidRequestError(
        `Report ${reportId} is closed and cannot be reassigned`,
        'ReportClosed',
      )
    }

    // NULL and -1 both mean "unassigned" for equivalence purposes.
    const currentQueueId = report.queueId ?? -1
    if (currentQueueId === toQueueId) {
      throw new InvalidRequestError(
        `Report ${reportId} is already in queue ${toQueueId}`,
        'AlreadyInTargetQueue',
      )
    }

    const previousStatus = report.status
    let nextStatus: string = previousStatus
    if (toQueueId !== -1 && previousStatus === 'open') {
      nextStatus = 'queued'
    } else if (toQueueId === -1 && previousStatus === 'queued') {
      nextStatus = 'open'
    }

    const now = new Date().toISOString()

    const reportUpdate: Record<string, string | number | null> = {
      queueId: toQueueId,
      queuedAt: toQueueId === -1 ? null : now,
      updatedAt: now,
    }
    if (nextStatus !== previousStatus) {
      reportUpdate.status = nextStatus
    }

    await dbTxn.db
      .updateTable('report')
      .set(reportUpdate)
      .where('id', '=', reportId)
      .execute()

    await dbTxn.db
      .insertInto('report_activity')
      .values({
        reportId,
        activityType: 'queueActivity',
        previousStatus,
        internalNote: comment ?? null,
        publicNote: null,
        meta: {
          fromQueueId: report.queueId ?? null,
          toQueueId,
        },
        isAutomated: false,
        createdBy,
        createdAt: now,
      })
      .execute()
  })
}
