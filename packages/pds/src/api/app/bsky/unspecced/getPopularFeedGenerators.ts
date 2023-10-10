import { proxy } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getPopularFeedGenerators({
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
