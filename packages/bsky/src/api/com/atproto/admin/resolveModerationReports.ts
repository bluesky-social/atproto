import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { adminVerifier } from '../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.resolveModerationReports({
    auth: adminVerifier(ctx.cfg.adminPassword),
    handler: async ({ input }) => {
      const { db, services } = ctx
      const moderationService = services.moderation(db)
      const { actionId, reportIds, createdBy } = input.body

      const moderationAction = await db.transaction(async (dbTxn) => {
        const moderationTxn = services.moderation(dbTxn)
        await moderationTxn.resolveReports({ reportIds, actionId, createdBy })
        return await moderationTxn.getActionOrThrow(actionId)
      })

      return {
        encoding: 'application/json',
        body: await moderationService.views.action(moderationAction),
      }
    },
  })
}
