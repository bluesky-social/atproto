import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedSkeleton({
    auth: ctx.authVerifierAnyAudience,
    handler: async ({ params, auth }) => {
      const { feed } = params
      const viewer = auth.credentials.did
      const localAlgo = ctx.algos[feed]

      if (!localAlgo) {
        throw new InvalidRequestError('Unknown feed', 'UnknownFeed')
      }

      const { cursor, feedItems } = await localAlgo(ctx, params, viewer)

      const skeleton = feedItems.map((item) => ({
        post: item.postUri,
        reason:
          item.uri === item.postUri
            ? undefined
            : {
                $type: 'app.bsky.feed.defs#skeletonReasonRepost',
                repost: item.uri,
              },
      }))

      return {
        encoding: 'application/json',
        body: {
          cursor,
          feed: skeleton,
        },
      }
    },
  })
}
