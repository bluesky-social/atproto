import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationEvent({
    auth: ctx.authVerifier.modOrRole,
    handler: async ({ params }) => {
      const { id } = params
      const db = ctx.db
      const modService = ctx.modService(db)
      const event = await modService.getEventOrThrow(id)
      const eventDetail = await modService.views.eventDetail(event)
      return {
        encoding: 'application/json',
        body: eventDetail,
      }
    },
  })
}
