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
      const headersToPassThru: Record<string, string> = {}
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
          headersToPassThru[key] = value
        }
      }
      const feedOpts = {
        headers: { ...headersToPassThru, ...serviceAuthHeaders.headers },
      }
      const res = await ctx.appViewAgent.api.app.bsky.feed.getFeed(
        params,
        feedOpts,
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
