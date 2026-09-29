import { AuthRequiredError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { com, tools } from '../../lexicons/index.js'
import { subjectFromInput } from '../../mod-service/subject.js'
import { ScheduledTakedownTag } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.moderation.cancelScheduledActions, {
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
            event:
              tools.ozone.moderation.defs.cancelScheduledTakedownEvent.$build({
                comment,
              }),
            subject: subjectFromInput(
              com.atproto.admin.defs.repoRef.$build({ did: subject }),
            ),
            createdBy,
            createdAt: now,
          })
          await modService.logEvent({
            event: tools.ozone.moderation.defs.modEventTag.$build({
              remove: [ScheduledTakedownTag],
              add: [],
            }),
            subject: subjectFromInput(
              com.atproto.admin.defs.repoRef.$build({ did: subject }),
            ),
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
