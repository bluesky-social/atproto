import { type Selectable, sql } from 'kysely'
import { currentDatetimeString, toDatetimeString } from '@atproto/lex'
import type { DatetimeString, DidString, LexMap } from '@atproto/lex'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { ScheduledActionStatus, ScheduledActionType } from '../api/util.js'
import type { Database } from '../db/index.js'
import type { ScheduledAction } from '../db/schema/scheduled-action.js'
import { runNotificationWork } from '../inbox/notification-work.js'
import type { tools } from '../lexicons/index.js'
import { dbLogger } from '../logger.js'
import { createReportActivity } from '../report/activity.js'
import { getEventActivityMetadata } from '../report/metadata.js'
import { notifyReportActivities } from '../report/notifications.js'
import type { ScheduledTakedownEventData, SchedulingParams } from './types.js'

export type ScheduledActionServiceCreator = (
  db: Database,
) => ScheduledActionService

export class ScheduledActionService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new ScheduledActionService(db)
  }

  formatScheduledAction(
    action: Selectable<ScheduledAction>,
  ): tools.ozone.moderation.defs.ScheduledActionView {
    return {
      id: action.id,
      action: action.action,
      eventData: action.eventData as LexMap | undefined,
      did: action.did,
      executeAt: action.executeAt
        ? toDatetimeString(action.executeAt)
        : undefined,
      executeAfter: action.executeAfter
        ? toDatetimeString(action.executeAfter)
        : undefined,
      executeUntil: action.executeUntil
        ? toDatetimeString(action.executeUntil)
        : undefined,
      randomizeExecution: action.randomizeExecution,
      createdBy: action.createdBy,
      createdAt: toDatetimeString(action.createdAt),
      updatedAt: toDatetimeString(action.updatedAt),
      status: action.status,
      lastExecutedAt: action.lastExecutedAt
        ? toDatetimeString(action.lastExecutedAt)
        : undefined,
      lastFailureReason: action.lastFailureReason || undefined,
      executionEventId: action.executionEventId || undefined,
    }
  }

  async scheduleAction(
    schedulingParams: SchedulingParams,
  ): Promise<Selectable<ScheduledAction>> {
    const { action, eventData, did, createdBy } = schedulingParams

    // Only allow one pending action at a time for a given subject and action type
    const existingAction = await this.getPendingActionForSubject(did, action)
    if (existingAction) {
      throw new InvalidRequestError(
        'A pending scheduled action already exists for this subject',
        'ActionAlreadyExists',
      )
    }

    // When a time-range for action is specified, ensure that the range is valid
    if (
      'executeAfter' in schedulingParams &&
      schedulingParams.executeAfter &&
      schedulingParams.executeUntil &&
      schedulingParams.executeAfter >= schedulingParams.executeUntil
    ) {
      throw new InvalidRequestError(
        'executeAfter must be before executeUntil',
        'InvalidScheduling',
      )
    }

    const now = currentDatetimeString()
    const randomizeExecution =
      !('executeAt' in schedulingParams) && 'executeAfter' in schedulingParams

    const scheduledAction = await this.db.db
      .insertInto('scheduled_action')
      .values({
        action,
        eventData: JSON.stringify(eventData),
        did,
        executeAt: randomizeExecution
          ? null
          : schedulingParams.executeAt &&
            toDatetimeString(schedulingParams.executeAt),
        executeAfter: randomizeExecution
          ? schedulingParams.executeAfter &&
            toDatetimeString(schedulingParams.executeAfter)
          : null,
        executeUntil: randomizeExecution
          ? schedulingParams.executeUntil &&
            toDatetimeString(schedulingParams.executeUntil)
          : null,
        randomizeExecution,
        createdBy,
        createdAt: now,
        updatedAt: now,
        status: 'pending',
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return scheduledAction
  }

  async getPendingActionForSubject(
    did: DidString,
    action: ScheduledActionType,
  ): Promise<Selectable<ScheduledAction> | null> {
    const scheduledAction = await this.db.db
      .selectFrom('scheduled_action')
      .selectAll()
      .where('did', '=', did)
      .where('action', '=', action)
      .where('status', '=', 'pending')
      .executeTakeFirst()

    return scheduledAction || null
  }

  async listScheduledActions({
    cursor,
    limit = 50,
    startTime,
    endTime,
    subjects,
    statuses = [],
    direction = 'desc',
  }: {
    cursor?: string
    limit?: number
    startTime?: Date
    endTime?: Date
    subjects?: DidString[]
    statuses: ScheduledActionStatus[]
    direction?: 'asc' | 'desc'
  }): Promise<{
    actions: Selectable<ScheduledAction>[]
    cursor?: string
  }> {
    let query = this.db.db
      .selectFrom('scheduled_action')
      .where('status', 'in', statuses)
      .selectAll()

    if (subjects && subjects.length > 0) {
      query = query.where('did', 'in', subjects)
    }

    if (startTime) {
      query = query.where((eb) =>
        eb.or([
          eb('executeAt', '>=', toDatetimeString(startTime)),
          eb('executeAfter', '>=', toDatetimeString(startTime)),
        ]),
      )
    }

    if (endTime) {
      query = query.where((eb) =>
        eb.or([
          eb('executeAt', '<=', toDatetimeString(endTime)),
          eb('executeUntil', '<=', toDatetimeString(endTime)),
          eb.and([
            eb('executeUntil', 'is', null),
            eb('executeAfter', '<=', toDatetimeString(endTime)),
          ]),
        ]),
      )
    }

    if (cursor) {
      query = query.where(
        'id',
        direction === 'asc' ? '>' : '<',
        parseInt(cursor, 10),
      )
    }

    const actions = await query.orderBy('id', direction).limit(limit).execute()

    return {
      actions,
      cursor: actions.at(-1)?.id?.toString(),
    }
  }

  async cancelScheduledActions(subjects: DidString[]): Promise<{
    succeeded: DidString[]
    failed: { did: DidString; error: string; errorCode?: string }[]
  }> {
    const succeeded: DidString[] = []
    const failed: { did: DidString; error: string; errorCode?: string }[] = []

    for (const did of subjects) {
      try {
        const result = await this.db.db
          .updateTable('scheduled_action')
          .set({
            status: 'cancelled',
            updatedAt: currentDatetimeString(),
          })
          .where('did', '=', did)
          .where('status', '=', 'pending')
          .executeTakeFirst()

        if (result.numUpdatedRows && result.numUpdatedRows > 0) {
          succeeded.push(did)
        } else {
          failed.push({
            did,
            error: 'No pending scheduled actions found for subject',
            errorCode: 'NoPendingActions',
          })
        }
      } catch (err) {
        dbLogger.error({ err, subjects }, 'Error cancelling scheduled action')
        failed.push({
          did,
          error: 'Unknown error',
          errorCode: 'DatabaseError',
        })
      }
    }

    return { succeeded, failed }
  }

  async getPendingActionsToExecute(
    now: Date,
  ): Promise<Selectable<ScheduledAction>[]> {
    return await this.db.db
      .selectFrom('scheduled_action')
      .selectAll()
      .where('status', '=', 'pending')
      .where((eb) =>
        eb.or([
          eb('executeAfter', '<=', toDatetimeString(now)),
          eb('executeAt', '<=', toDatetimeString(now)),
        ]),
      )
      .execute()
  }

  async markActionAsExecuted(
    actionId: number,
    executionEventId: number,
  ): Promise<void> {
    const now = currentDatetimeString()
    await this.db.db
      .updateTable('scheduled_action')
      .set({
        status: 'executed',
        lastExecutedAt: now,
        executionEventId,
        updatedAt: now,
      })
      .where('id', '=', actionId)
      .execute()
  }

  /**
   * Returns a query for scheduled reports linked to the given action.
   */
  private scheduledReportQuery(action: Selectable<ScheduledAction>) {
    const eventData = action.eventData as ScheduledTakedownEventData | null
    const eventId = eventData?.reportEventId
    if (!Number.isSafeInteger(eventId) || !eventId || eventId < 1) return null

    return this.db.db
      .selectFrom('report as r')
      .where('r.did', '=', action.did)
      .where('r.recordPath', '=', '')
      .where('r.subjectMessageId', 'is', null)
      .where('r.subjectConvoId', 'is', null)
      .where('r.status', '=', 'closed')
      .where(
        sql<string>`(
          select activity.meta ->> 'actionEventId'
          from report_activity activity
          where activity."reportId" = r.id
            and activity."activityType" = 'closeActivity'
          order by activity."createdAt" desc, activity.id desc
          limit 1
        )`,
        '=',
        String(eventId),
      )
  }

  /**
   * Links the reports to the given scheduled action.
   */
  async linkExecutedReports(
    action: Selectable<ScheduledAction>,
    executionEventId: number,
    executedAt: DatetimeString,
    inboxStartAt?: DatetimeString,
  ): Promise<void> {
    this.db.assertTransaction()
    const query = this.scheduledReportQuery(action)
    if (!query) return
    let cursor = 0
    let batchSize: number
    do {
      const reports = await query
        .where('r.id', '>', cursor)
        .select('r.id')
        .orderBy('r.id')
        .limit(500)
        .forUpdate('r')
        .execute()
      batchSize = reports.length
      if (!batchSize) return

      // @NOTE Recheck closure history after acquiring locks with a fresh snapshot.
      const eligible = query
        .where(
          'r.id',
          'in',
          reports.map((report) => report.id),
        )
        .select('r.id')
      const updated = await this.db.db
        .updateTable('report')
        .set({
          actionEventIds: sql`coalesce("actionEventIds", '[]'::jsonb) || ${JSON.stringify(executionEventId)}::jsonb`,
          updatedAt: executedAt,
        })
        .where('id', 'in', eligible)
        .returning('id')
        .execute()
      if (updated.length) {
        await runNotificationWork(this.db, async (txn) => {
          const closures = await txn.db
            .selectFrom('report as r')
            .where(
              'r.id',
              'in',
              updated.map((report) => report.id),
            )
            .innerJoinLateral(
              (eb) =>
                eb
                  .selectFrom('report_activity')
                  .whereRef('reportId', '=', 'r.id')
                  .where('activityType', '=', 'closeActivity')
                  .orderBy('createdAt', 'desc')
                  .orderBy('id', 'desc')
                  .limit(1)
                  .select(['id as activityId', 'activityType'])
                  .as('closure'),
              (join) => join.onTrue(),
            )
            .select([
              'r.id as reportId',
              'closure.activityId',
              'closure.activityType',
            ])
            .execute()
          await notifyReportActivities(
            txn,
            closures.map((closure) => ({ ...closure, createdAt: executedAt })),
            inboxStartAt,
          )
        })
      }
      cursor = reports[reports.length - 1].id
    } while (batchSize === 500)
  }

  /**
   * Attempt to reopen the oldest report associated with an action.
   */
  async reopenOldestScheduledReport(
    action: Selectable<ScheduledAction>,
    failureReason: string,
    inboxStartAt?: DatetimeString,
  ): Promise<void> {
    this.db.assertTransaction()
    const query = this.scheduledReportQuery(action)
    if (!query) return

    for (;;) {
      const report = await query
        .select('r.id')
        .orderBy('r.createdAt')
        .orderBy('r.id')
        .limit(1)
        .forUpdate('r')
        .executeTakeFirst()
      if (!report) return
      const eligible = await query
        .where('r.id', '=', report.id)
        .select('r.id')
        .executeTakeFirst()
      if (!eligible) continue

      const eventData = action.eventData as ScheduledTakedownEventData
      await createReportActivity(this.db, {
        reportId: report.id,
        activityType: 'reopenActivity',
        createdBy: action.createdBy,
        isAutomated: true,
        inboxStartAt,
        internalNote: 'Scheduled takedown failed',
        meta: {
          ...getEventActivityMetadata(eventData.modTool),
          scheduledActionId: action.id,
          schedulingEventId: eventData.reportEventId,
          failureReason,
        },
      })
      return
    }
  }

  async markActionAsFailed(
    actionId: number,
    failureReason: string,
  ): Promise<void> {
    const now = currentDatetimeString()
    await this.db.db
      .updateTable('scheduled_action')
      .set({
        status: 'failed',
        lastExecutedAt: now,
        lastFailureReason: failureReason,
        updatedAt: now,
      })
      .where('id', '=', actionId)
      .execute()
  }
}
