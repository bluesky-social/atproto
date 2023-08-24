import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationReports({
    auth: ctx.roleVerifier,
    handler: async ({ req, params }) => {
      if (ctx.shouldProxyModeration()) {
        const { data: result } =
          await ctx.appviewAgent.com.atproto.admin.getModerationReports(
            params,
            authPassthru(req),
          )
        return {
          encoding: 'application/json',
          body: result,
        }
      }

      const { db, services } = ctx
      const {
        subject,
        resolved,
        actionType,
        limit = 50,
        cursor,
        ignoreSubjects = [],
        reverse = false,
        reporters = [],
        actionedBy,
      } = params
      const moderationService = services.moderation(db)
      const results = await moderationService.getReports({
        subject,
        resolved,
        actionType,
        limit,
        cursor,
        ignoreSubjects,
        reverse,
        reporters,
        actionedBy,
      })
      return {
        encoding: 'application/json',
        body: {
          cursor: results.at(-1)?.id.toString() ?? undefined,
          reports: await moderationService.views.report(results),
        },
      }
    },
  })
}
