import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  const { appViewAgent } = ctx
  if (!appViewAgent) return
  server.app.bsky.notification.updateSeen({
    auth: ctx.authVerifier.access,
    handler: async ({ input, auth }) => {
      const requester = auth.credentials.did

      await appViewAgent.api.app.bsky.notification.updateSeen(input.body, {
        ...(await ctx.appviewAuthHeaders(requester)),
        encoding: 'application/json',
      })
    },
  })
}
