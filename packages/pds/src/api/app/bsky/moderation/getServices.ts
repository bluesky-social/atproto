import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.moderation.getServices({
    auth: ctx.authVerifier.access,
    handler: async ({ params, auth, req }) => {
      const requester = auth.credentials.did
      const res = await ctx.appViewAgent.api.app.bsky.moderation.getServices(
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
