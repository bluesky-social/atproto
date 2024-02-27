import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { pipethrough } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx.cfg
  if (!bskyAppView) return
  server.app.bsky.notification.getUnreadCount({
    auth: ctx.authVerifier.access,
    handler: async ({ auth, params, req }) => {
      const requester = auth.credentials.did
      return pipethrough(
        bskyAppView.url,
        'app.bsky.notification.getUnreadCount',
        params,
        await ctx.appviewAuthHeaders(requester, req),
      )
    },
  })
}
