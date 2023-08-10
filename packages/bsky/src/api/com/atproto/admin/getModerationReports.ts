import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationReports({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const {
        subject,
        resolved,
        actionType,
        limit = 50,
        cursor,
        ignoreSubjects,
        reverse = false,
        reporters = [],
        actionedBy,
      } = params
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
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
