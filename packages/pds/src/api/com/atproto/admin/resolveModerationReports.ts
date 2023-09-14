import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.resolveModerationReports({
    auth: ctx.roleVerifier,
    handler: async ({ req, input }) => {
      if (ctx.cfg.bskyAppView.proxyModeration) {
        const { data: result } =
          await ctx.appViewAgent.com.atproto.admin.resolveModerationReports(
            input.body,
            authPassthru(req, true),
          )
        return {
          encoding: 'application/json',
          body: result,
        }
      }

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
