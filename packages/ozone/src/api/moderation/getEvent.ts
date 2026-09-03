import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.moderation.getEvent, {
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
