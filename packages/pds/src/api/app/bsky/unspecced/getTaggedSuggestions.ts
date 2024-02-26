import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getTaggedSuggestions({
    auth: ctx.authVerifier.access,
    handler: async ({ auth, params, req }) => {
      const requester = auth.credentials.did
      const res =
        await ctx.appViewAgent.api.app.bsky.unspecced.getTaggedSuggestions(
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
