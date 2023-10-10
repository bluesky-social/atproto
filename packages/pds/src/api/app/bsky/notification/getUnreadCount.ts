import { proxy } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.getUnreadCount({
    auth: ctx.accessVerifier,
    handler: async (request) => {
      const { auth } = request
      const requester = auth.credentials.did
      return proxy(
        request,
        ctx.appViewAgent.service.href,
        await ctx.serviceAuthHeaders(requester),
      )
    },
  })
}
