import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { pipethrough } from '../../../../pipethrough'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx.cfg
  if (!bskyAppView) return
  server.app.bsky.unspecced.getPopularFeedGenerators({
    auth: ctx.authVerifier.access,
    handler: async ({ auth, params, req }) => {
      const requester = auth.credentials.did
      return pipethrough(
        bskyAppView.url,
        'app.bsky.unspecced.getPopularFeedGenerators',
        params,
        await ctx.appviewAuthHeaders(requester, req),
      )
    },
  })
}
