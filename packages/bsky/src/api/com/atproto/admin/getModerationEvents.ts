import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationEvents({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const { subject, limit = 50, cursor, sortDirection } = params
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const results = await moderationService.getEvents({
        subject,
        limit,
        cursor,
        sortDirection,
      })
      return {
        encoding: 'application/json',
        body: {
          cursor: results.at(-1)?.id.toString() ?? undefined,
          events: await moderationService.views.event(results),
        },
      }
    },
  })
}
