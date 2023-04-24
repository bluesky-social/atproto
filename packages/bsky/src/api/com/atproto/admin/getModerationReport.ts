import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { adminVerifier } from '../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationReport({
    auth: adminVerifier(ctx.cfg.adminPassword),
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
