import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getFollows({
    auth: ctx.authVerifier.access,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did

      if (req.headers['atproto-forward']) {
        const res = await ctx.moderationAgent.api.app.bsky.graph.getFollows(
          params,
          await ctx.moderationAuthHeaders(requester, req),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const res = await ctx.appViewAgent.api.app.bsky.graph.getFollows(
        params,
        await ctx.appviewAuthHeaders(requester, req),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
