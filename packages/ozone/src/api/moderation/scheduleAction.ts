import type { DidString } from '@atproto/lex'
import {
  AuthRequiredError,
  InvalidRequestError,
  type Server,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { com, tools } from '../../lexicons/index.js'
import { subjectFromInput } from '../../mod-service/subject.js'
import type { ExecutionSchedule } from '../../scheduled-action/types.js'
import { getScheduledActionType } from '../util.js'
import { ScheduledTakedownTag } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.moderation.scheduleAction, {
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

      const succeeded: DidString[] = []
      const failed: tools.ozone.moderation.scheduleAction.FailedScheduling[] =
        []

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
            if (
              tools.ozone.moderation.scheduleAction.takedown.$isTypeOf(action)
            ) {
              await modService.logEvent({
                event: tools.ozone.moderation.defs.scheduleTakedownEvent.$build(
                  {
                    executeAfter: scheduling.executeAfter,
                    executeUntil: scheduling.executeUntil,
                    executeAt: scheduling.executeAt,
                    comment: action.comment,
                  },
                ),
                subject: subjectFromInput(
                  com.atproto.admin.defs.repoRef.$build({ did: subject }),
                ),
                createdBy: actualCreatedBy,
                createdAt: now,
                modTool,
              })
              await modService.logEvent({
                event: tools.ozone.moderation.defs.modEventTag.$build({
                  add: [ScheduledTakedownTag],
                  remove: [],
                }),
                subject: subjectFromInput(
                  com.atproto.admin.defs.repoRef.$build({ did: subject }),
                ),
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
