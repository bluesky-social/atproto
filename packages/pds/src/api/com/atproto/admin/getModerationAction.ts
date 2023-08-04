import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationAction({
    auth: ctx.roleVerifier,
    handler: async ({ req, params, auth }) => {
      if (ctx.shouldProxyModeration()) {
        // @TODO merge invite details into action subject
        const { data: result } =
          await ctx.appviewAgent.com.atproto.admin.getModerationAction(
            params,
            authPassthru(req),
          )
        return {
          encoding: 'application/json',
          body: result,
        }
      }

      const access = auth.credentials
      const { db, services } = ctx
      const { id } = params
      const moderationService = services.moderation(db)
      const result = await moderationService.getActionOrThrow(id)
      return {
        encoding: 'application/json',
        body: await moderationService.views.actionDetail(result, {
          includeEmails: access.moderator,
        }),
      }
    },
  })
}
