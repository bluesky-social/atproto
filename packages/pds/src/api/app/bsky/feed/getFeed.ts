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
      const headers: Record<string, string> = {}
      const headersToForward = ['accept-language']
      for (const header of headersToForward) {
        const value = req.headers[header]
        if (typeof value === 'string') {
          headers[header] = value
        }
      }
      const feedOpts = {
        headers: { ...headers, ...serviceAuthHeaders.headers },
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
