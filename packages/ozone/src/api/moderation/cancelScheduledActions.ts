import { AuthRequiredError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { subjectFromInput } from '../../mod-service/subject'
import { ScheduledTakedownTag } from './util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.cancelScheduledActions({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { subjects, comment } = input.body

      if (!access.isModerator) {
        throw new AuthRequiredError(
          'Must be a moderator to cancel scheduled actions',
        )
      }

      const createdBy =
        access.type === 'admin_token' ? ctx.cfg.service.did : access.iss
      const now = new Date()

      const result = await db.transaction(async (tx) => {
        const scheduledActionService = ctx.scheduledActionService(tx)
        const modService = ctx.modService(tx)

        const cancellations =
          await scheduledActionService.cancelScheduledActions(subjects)

        for (const subject of cancellations.succeeded) {
          await modService.logEvent({
            event: {
              $type: 'tools.ozone.moderation.defs#cancelScheduledTakedownEvent',
              comment,
            },
            subject: subjectFromInput({
              did: subject,
              $type: 'com.atproto.admin.defs#repoRef',
            }),
            createdBy,
            createdAt: now,
          })
          await modService.logEvent({
            event: {
              $type: 'tools.ozone.moderation.defs#modEventTag',
              remove: [ScheduledTakedownTag],
              add: [],
            },
            subject: subjectFromInput({
              did: subject,
              $type: 'com.atproto.admin.defs#repoRef',
            }),
            createdBy,
            createdAt: now,
          })
        }

        return cancellations
      })

      return {
        encoding: 'application/json',
        body: {
          succeeded: result.succeeded,
          failed: result.failed,
        },
      }
    },
  })
}
