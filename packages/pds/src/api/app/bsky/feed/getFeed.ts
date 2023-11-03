import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeed({
    auth: ctx.authVerifier.access,
    handler: async ({ params, auth }) => {
      const requester = auth.credentials.did

      const { data: feed } =
        await ctx.appViewAgent.api.app.bsky.feed.getFeedGenerator(
          { feed: params.feed },
          await ctx.serviceAuthHeaders(requester),
        )
      const res = await ctx.appViewAgent.api.app.bsky.feed.getFeed(
        params,
        await ctx.serviceAuthHeaders(requester, feed.view.did),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
