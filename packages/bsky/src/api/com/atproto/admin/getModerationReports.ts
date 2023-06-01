import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { adminVerifier } from '../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationReports({
    auth: adminVerifier(ctx.cfg.adminPassword),
    handler: async ({ params }) => {
      const { db, services } = ctx
      const {
        subject,
        resolved,
        actionType,
        limit = 50,
        cursor,
        ignoreSubjects,
        reverse = false,
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
