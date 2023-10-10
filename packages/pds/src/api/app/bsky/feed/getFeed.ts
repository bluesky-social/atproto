import { proxy } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeed({
    auth: ctx.accessVerifier,
    handler: async (request) => {
      const { params, auth } = request
      const requester = auth.credentials.did

      const { data: feed } =
        await ctx.appViewAgent.api.app.bsky.feed.getFeedGenerator(
          { feed: params.feed },
          await ctx.serviceAuthHeaders(requester),
        )

      return proxy(
        request,
        ctx.appViewAgent.service.href,
        await ctx.serviceAuthHeaders(requester, feed.view.did),
      )
    },
  })
}
