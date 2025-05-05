import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.getEvent({
    auth: ctx.authVerifier.modOrAdminToken,
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
