import { MINUTE, SECOND } from '@atproto/common'
import { Database } from '../db'
import {
  ModEventTakedown,
  ModTool,
} from '../lexicon/types/tools/ozone/moderation/defs'
import { dbLogger } from '../logger'
import { ModerationServiceCreator } from '../mod-service'
import { subjectFromInput } from '../mod-service/subject'
import { ModEventType } from '../mod-service/types'
import { ScheduledActionServiceCreator } from '../scheduled-action/service'

export class ScheduledActionProcessor {
  destroyed = false
  processingPromise: Promise<void> = Promise.resolve()
  timer?: NodeJS.Timeout

  constructor(
    private db: Database,
    private modService: ModerationServiceCreator,
    private scheduledActionService: ScheduledActionServiceCreator,
  ) {}

  start() {
    this.poll()
  }

  poll() {
    if (this.destroyed) return
    this.processingPromise = this.findAndExecuteScheduledActions()
      .catch((err) =>
        dbLogger.error({ err }, 'scheduled action processing errored'),
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

  async executeScheduledAction(actionId: number) {
    await this.db.transaction(async (dbTxn) => {
      const moderationTxn = this.modService(dbTxn)
      const scheduledActionTxn = this.scheduledActionService(dbTxn)

      try {
        // maybe overfetching here to get the action again within the transaction to ensure it's still pending
        const action = await dbTxn.db
          .selectFrom('scheduled_action')
          .selectAll()
          .where('id', '=', actionId)
          .where('status', '=', 'pending')
          .executeTakeFirst()

        if (!action) {
          // already processed or cancelled
          return
        }

        let event: ModEventType
        let modTool: ModTool | undefined

        // Create the appropriate moderation action based on the scheduled action type
        switch (action.action) {
          case 'takedown':
            {
              const eventData = action.eventData as ModEventTakedown & {
                modTool?: ModTool
              }
              modTool = eventData.modTool
              event = {
                $type: 'tools.ozone.moderation.defs#modEventTakedown',
                comment: `[SCHEDULED_ACTION] ${eventData.comment || 'Scheduled takedown executed'}`,
                durationInHours: eventData.durationInHours,
                acknowledgeAccountSubjects:
                  eventData.acknowledgeAccountSubjects,
                policies: eventData.policies,
              }
            }
            break
          default:
            throw new Error(
              `Unsupported scheduled action type: ${action.action}`,
            )
        }

        // Execute the moderation action
        const moderationEvent = await moderationTxn.logEvent({
          event,
          subject: subjectFromInput({
            $type: 'com.atproto.admin.defs#repoRef',
            did: action.did,
          }),
          createdBy: action.createdBy,
          modTool,
        })

        // Mark the scheduled action as executed
        await scheduledActionTxn.markActionAsExecuted(
          actionId,
          moderationEvent.event.id,
        )

        dbLogger.info(
          {
            scheduledActionId: actionId,
            moderationEventId: moderationEvent.event.id,
            did: action.did,
          },
          'executed scheduled action',
        )
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'

        // mark as failed
        await scheduledActionTxn.markActionAsFailed(actionId, errorMessage)

        dbLogger.error(
          {
            scheduledActionId: actionId,
            error: errorMessage,
          },
          'failed to execute scheduled action',
        )
      }
    })
  }

  async findAndExecuteScheduledActions() {
    const scheduledActionService = this.scheduledActionService(this.db)
    const now = new Date()

    const actionsToExecute =
      await scheduledActionService.getPendingActionsToExecute(now)

    for (const action of actionsToExecute) {
      // For randomized execution, check if we should execute now or wait
      if (action.randomizeExecution && action.executeAfter) {
        const executeAfter = new Date(action.executeAfter)
        // Default to a 30 second window for execution
        const executeUntil = action.executeUntil
          ? new Date(action.executeUntil)
          : new Date(executeAfter.getTime() + 30 * SECOND)

        // Only execute if we're past the earliest time
        if (now < executeAfter) {
          continue
        }

        // For randomized scheduling, randomly decide whether to execute now
        // The probability increases as we get closer to the deadline
        const timeRange = executeUntil.getTime() - executeAfter.getTime()
        const timeElapsed = now.getTime() - executeAfter.getTime()
        const executeProb = Math.min(timeElapsed / timeRange, 1)

        // Execute with increasing probability as we approach the deadline
        // Always execute if we're at or past the deadline
        if (now < executeUntil && Math.random() > executeProb * 0.1) {
          continue
        }
      }

      await this.executeScheduledAction(action.id)
    }
  }
}

const getInterval = (): number => {
  // Process scheduled actions every minute
  const now = Date.now()
  const intervalMs = MINUTE
  const nextIteration = Math.ceil(now / intervalMs)
  return nextIteration * intervalMs - now
}
