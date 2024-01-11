import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.listNotifications({
    auth: ctx.authVerifier.access,
    handler: async ({ params, auth, req }) => {
      const requester = auth.credentials.did
      const res =
        await ctx.appViewAgent.api.app.bsky.notification.listNotifications(
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
