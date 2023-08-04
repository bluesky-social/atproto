import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationReport({
    auth: ctx.roleVerifier,
    handler: async ({ req, params, auth }) => {
      if (ctx.shouldProxyModeration()) {
        const { data: result } =
          await ctx.appviewAgent.com.atproto.admin.getModerationReport(
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
      const result = await moderationService.getReportOrThrow(id)
      return {
        encoding: 'application/json',
        body: await moderationService.views.reportDetail(result, {
          includeEmails: access.moderator,
        }),
      }
    },
  })
}
