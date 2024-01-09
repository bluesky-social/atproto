import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { forwardResHeader } from '@atproto/xrpc-server/src/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeed({
    auth: ctx.authVerifier.access,
    handler: async ({ req, res, params, auth }) => {
      const requester = auth.credentials.did

      const { data: feed } =
        await ctx.appViewAgent.api.app.bsky.feed.getFeedGenerator(
          { feed: params.feed },
          await ctx.appviewAuthHeaders(requester),
        )
      const serviceAuthHeaders = await ctx.serviceAuthHeaders(
        requester,
        feed.view.did,
      )
      // forward accept-language header to upstream services
      serviceAuthHeaders.headers['accept-language'] =
        req.headers['accept-language']
      const feedRes = await ctx.appViewAgent.api.app.bsky.feed.getFeed(
        params,
        serviceAuthHeaders,
      )
      forwardResHeader(res, feedRes.headers, 'content-language')

      return {
        encoding: 'application/json',
        body: feedRes.data,
      }
    },
  })
}
