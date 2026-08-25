import type { Selectable } from 'kysely'
import { currentDatetimeString, toDatetimeString } from '@atproto/lex'
import type { DidString, LexMap } from '@atproto/lex'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { ScheduledActionStatus, ScheduledActionType } from '../api/util.js'
import type { Database } from '../db/index.js'
import type { ScheduledAction } from '../db/schema/scheduled-action.js'
import type { tools } from '../lexicons/index.js'
import { dbLogger } from '../logger.js'
import type { SchedulingParams } from './types.js'

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
