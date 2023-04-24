import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationReport({
    auth: ctx.moderatorVerifier,
    handler: async ({ params }) => {
      const { db, services } = ctx
      const { id } = params
      const moderationService = services.moderation(db)
      const result = await moderationService.getReportOrThrow(id)
      return {
        encoding: 'application/json',
        body: await moderationService.views.reportDetail(result),
      }
    },
  })
}
