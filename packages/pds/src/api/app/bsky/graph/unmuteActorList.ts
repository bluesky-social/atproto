import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru, proxy } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.unmuteActorList({
    auth: ctx.authVerifier.access,
    handler: async ({ auth, input, req }) => {
      const proxied = await proxy(
        ctx,
        auth.credentials.audience,
        async (agent) => {
          await agent.api.app.bsky.graph.unmuteActorList(
            input.body,
            authPassthru(req, true),
          )
        },
      )
      if (proxied !== null) {
        return proxied
      }

      const requester = auth.credentials.did
      await ctx.appViewAgent.api.app.bsky.graph.unmuteActorList(input.body, {
        ...(await ctx.serviceAuthHeaders(requester)),
        encoding: 'application/json',
      })
    },
  })
}
