import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationEvent({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const { id } = params
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const event = await moderationService.getEventOrThrow(id)
      const eventDetail = await moderationService.views.eventDetail(event)
      return {
        encoding: 'application/json',
        body: eventDetail,
      }
    },
  })
}
