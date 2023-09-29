import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationStatuses({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const { subject, status, limit = 50, cursor } = params
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const results = await moderationService.getSubjectStatuses({
        subject,
        status,
        limit,
        cursor,
      })
      return {
        encoding: 'application/json',
        body: {
          cursor: results.at(-1)?.id.toString() ?? undefined,
          subjectStatuses: await moderationService.views.subjectStatus(results),
        },
      }
    },
  })
}
