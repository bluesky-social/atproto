import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'
import { authPassthru } from '../../../../../api/com/atproto/admin/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getFollows({
    auth: ctx.accessOrRoleVerifier,
    handler: async ({ req, params, auth }) => {
      const requester =
        auth.credentials.type === 'access' ? auth.credentials.did : null
      const res = await ctx.appviewAgent.api.app.bsky.graph.getFollows(
        params,
        requester ? await ctx.serviceAuthHeaders(requester) : authPassthru(req),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
