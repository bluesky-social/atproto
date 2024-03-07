import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  const { appViewAgent } = ctx
  if (!appViewAgent) return
  server.app.bsky.graph.muteActor({
    auth: ctx.authVerifier.access,
    handler: async ({ auth, input, req }) => {
      const requester = auth.credentials.did

      await appViewAgent.api.app.bsky.graph.muteActor(input.body, {
        ...(await ctx.appviewAuthHeaders(requester, req)),
        encoding: 'application/json',
      })
    },
  })
}
