import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { proxy } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getListFeed({
    auth: ctx.authVerifier.access,
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
