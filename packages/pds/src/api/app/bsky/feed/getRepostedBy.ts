import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getRepostedBy({
    auth: ctx.authVerifier.access,
    handler: async ({ params, auth }) => {
      const requester = auth.credentials.did
      const res = await ctx.appViewAgent.api.app.bsky.feed.getRepostedBy(
        params,
        await ctx.appviewAuthHeaders(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
