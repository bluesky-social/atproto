import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationReport({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const { id } = params
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const result = await moderationService.getReportOrThrow(id)
      return {
        encoding: 'application/json',
        body: await moderationService.views.reportDetail(result),
      }
    },
  })
}
