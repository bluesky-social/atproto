import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationActions({
    auth: ctx.authVerifier.role,
    handler: async ({ req, params }) => {
      if (ctx.cfg.bskyAppView.proxyModeration) {
        const { data: result } =
          await ctx.appViewAgent.com.atproto.admin.getModerationActions(
            params,
            authPassthru(req),
          )
        return {
          encoding: 'application/json',
          body: result,
        }
      }

      const { db, services } = ctx
      const { subject, limit = 50, cursor } = params
      const moderationService = services.moderation(db)
      const results = await moderationService.getActions({
        subject,
        limit,
        cursor,
      })
      return {
        encoding: 'application/json',
        body: {
          cursor: results.at(-1)?.id.toString() ?? undefined,
          actions: await moderationService.views.action(results),
        },
      }
    },
  })
}
