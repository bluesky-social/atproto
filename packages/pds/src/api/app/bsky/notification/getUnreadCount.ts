import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { pipethrough } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.getUnreadCount({
    auth: ctx.authVerifier.access,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      return pipethrough(
        ctx.cfg.bskyAppView.url,
        'app.bsky.notification.getUnreadCount',
        params,
        await ctx.appviewAuthHeaders(requester),
      )
    },
  })
}
