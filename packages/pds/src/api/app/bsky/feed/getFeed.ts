import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { pipethrough } from '../../../../pipethrough'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  const { appViewAgent } = ctx
  const { bskyAppView } = ctx.cfg
  if (!appViewAgent || !bskyAppView) return
  server.app.bsky.feed.getFeed({
    auth: ctx.authVerifier.accessStandard(),
    handler: async ({ params, auth, req }) => {
      const requester = auth.credentials.did

      const { data: feed } =
        await appViewAgent.api.app.bsky.feed.getFeedGenerator(
          { feed: params.feed },
          await ctx.appviewAuthHeaders(
            requester,
            ids.AppBskyFeedGetFeedGenerator,
          ),
        )

      return pipethrough(ctx, req, {
        iss: requester,
        aud: feed.view.did,
        lxm: ids.AppBskyFeedGetFeedSkeleton,
      })
    },
  })
}
