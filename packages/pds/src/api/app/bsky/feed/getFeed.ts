import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeed({
    auth: ctx.authVerifier.access,
    handler: async ({ req, params, auth }) => {
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
      const res = await ctx.appViewAgent.api.app.bsky.feed.getFeed(
        params,
        serviceAuthHeaders,
      )

      return {
        encoding: 'application/json',
        body: res.data,
        headers: {
          'content-language': res.headers['content-language'],
        },
      }
    },
  })
}
