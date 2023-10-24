import { proxy } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getFollowers({
    auth: ctx.authVerifier.accessOrRole,
    handler: async (request) => {
      const { auth } = request
      const requester =
        auth.credentials.type === 'access' ? auth.credentials.did : null
      return proxy(
        request,
        ctx.appViewAgent.service.href,
        requester ? await ctx.serviceAuthHeaders(requester) : undefined,
      )
    },
  })
}
