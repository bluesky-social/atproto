import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getRepo({
    auth: ctx.authVerifier.access,
    handler: async ({ req, params, auth }) => {
      const res = await ctx.moderationAgent.com.atproto.admin.getRepo(
        params,
        await ctx.moderationAuthHeaders(auth.credentials.did, req),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
