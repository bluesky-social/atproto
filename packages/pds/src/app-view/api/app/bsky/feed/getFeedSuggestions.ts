import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedSuggestions({
    auth: ctx.accessVerifier,
    handler: async ({ req, auth, params }) => {
      const requester = auth.credentials.did

      if (await ctx.canProxyRead(req, requester)) {
        const res = await ctx.appviewAgent.api.app.bsky.feed.getFeedSuggestions(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      return {
        encoding: 'application/json',
        body: {
          feeds: [],
        },
      }
    },
  })
}
