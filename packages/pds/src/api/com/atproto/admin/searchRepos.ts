import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchRepos({
    auth: ctx.authVerifier.access,
    handler: async ({ req, params, auth }) => {
      const { data: result } =
        await ctx.moderationAgent.com.atproto.admin.searchRepos(
          params,
          await ctx.moderationAuthHeaders(auth.credentials.did, req),
        )
      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
