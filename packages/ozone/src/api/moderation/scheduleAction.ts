import { ToolsOzoneModerationScheduleAction } from '@atproto/api'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { subjectFromInput } from '../../mod-service/subject'
import { ExecutionSchedule } from '../../scheduled-action/types'
import { getScheduledActionType } from '../util'
import { ScheduledTakedownTag } from './util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.scheduleAction({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { action, subjects, createdBy, scheduling, modTool } = input.body

      if (!access.isModerator) {
        throw new AuthRequiredError('Must be a moderator to schedule actions')
      }

      if (access.type === 'admin_token' && !createdBy) {
        throw new AuthRequiredError(
          'Must specify createdBy when using admin auth',
        )
      }

      const actionType = getScheduledActionType(
        action.$type?.split('#')[1] || '',
      )

      const succeeded: string[] = []
      const failed: ToolsOzoneModerationScheduleAction.FailedScheduling[] = []

      // Defining alternatively required fields is not supported by lexicons so we need to manually validate here
      if (!scheduling.executeAt && !scheduling.executeAfter) {
        throw new InvalidRequestError('Must specify an execution schedule')
      }

      const executionSchedule: ExecutionSchedule = scheduling.executeAt
        ? { executeAt: new Date(scheduling.executeAt) }
        : {
            executeAfter: new Date(scheduling.executeAfter!),
            executeUntil: scheduling.executeUntil
              ? new Date(scheduling.executeUntil)
              : undefined,
          }

      const eventData = { ...action, modTool }
      const actualCreatedBy =
        access.type === 'admin_token' ? createdBy : access.iss

      const now = new Date()
      for (const subject of subjects) {
        try {
          await db.transaction(async (tx) => {
            const modService = ctx.modService(tx)
            const scheduledActionService = ctx.scheduledActionService(tx)
            // register the action in database
            await scheduledActionService.scheduleAction({
              action: actionType,
              eventData,
              did: subject,
              createdBy: actualCreatedBy,
              ...executionSchedule,
            })
            // log an event in the mod event stream
            if (ToolsOzoneModerationScheduleAction.isTakedown(action)) {
              await modService.logEvent({
                event: {
                  $type: 'tools.ozone.moderation.defs#scheduleTakedownEvent',
                  executeAfter: scheduling.executeAfter,
                  executeUntil: scheduling.executeUntil,
                  executeAt: scheduling.executeAt,
                  comment: action.comment,
                },
                subject: subjectFromInput({
                  did: subject,
                  $type: 'com.atproto.admin.defs#repoRef',
                }),
                createdBy: actualCreatedBy,
                createdAt: now,
                modTool,
              })
              await modService.logEvent({
                event: {
                  $type: 'tools.ozone.moderation.defs#modEventTag',
                  add: [ScheduledTakedownTag],
                  remove: [],
                },
                subject: subjectFromInput({
                  did: subject,
                  $type: 'com.atproto.admin.defs#repoRef',
                }),
                createdBy,
                createdAt: now,
              })
            }
            succeeded.push(subject)
          })
        } catch (error) {
          let errorMessage = 'Unknown error'
          let errorCode: string | undefined

          if (error instanceof InvalidRequestError) {
            errorMessage = error.message
            errorCode = 'InvalidRequest'
          } else if (error instanceof Error) {
            errorMessage = error.message
          }

          failed.push({
            subject,
            error: errorMessage,
            errorCode,
          })
        }
      }

      return {
        encoding: 'application/json',
        body: {
          succeeded,
          failed,
        },
      }
    },
  })
}
