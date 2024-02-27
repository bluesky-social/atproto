import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { pipethrough } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  const { appViewAgent } = ctx
  const { bskyAppView } = ctx.cfg
  if (!appViewAgent || !bskyAppView) return
  server.app.bsky.feed.getFeed({
    auth: ctx.authVerifier.access,
    handler: async ({ params, auth, req }) => {
      const requester = auth.credentials.did

      const { data: feed } =
        await appViewAgent.api.app.bsky.feed.getFeedGenerator(
          { feed: params.feed },
          await ctx.appviewAuthHeaders(requester, req),
        )
      const serviceAuthHeaders = await ctx.serviceAuthHeaders(
        requester,
        feed.view.did,
        req,
      )
      // forward accept-language header to upstream services
      serviceAuthHeaders.headers['accept-language'] =
        req.headers['accept-language']
      return pipethrough(
        bskyAppView.url,
        'app.bsky.feed.getFeed',
        params,
        serviceAuthHeaders,
      )
    },
  })
}
