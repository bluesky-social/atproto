import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.emitModerationEvent({
    auth: ctx.roleVerifier,
    handler: async ({ req, input }) => {
      const { db, services } = ctx
      if (ctx.cfg.bskyAppView.proxyModeration) {
        const { data: result } =
          await ctx.appViewAgent.com.atproto.admin.emitModerationEvent(
            input.body,
            authPassthru(req, true),
          )

        return {
          encoding: 'application/json',
          body: result,
        }
      }

      // TODO: this is temporary until we get rid of these endpoints from PDS
      const moderationService = services.moderation(db)
      const testEvent = await moderationService.getActionOrThrow(1)

      return {
        encoding: 'application/json',
        body: await moderationService.views.action(testEvent),
      }
    },
  })
}
