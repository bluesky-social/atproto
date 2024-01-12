import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { skeleton } from '../feed/getTimeline'
import { toSkeletonItem } from '../../../feed-gen/types'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getTimelineSkeleton({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      const viewer = auth.credentials.iss
      const result = await skeleton({ ctx, params: { ...params, viewer } })
      const feed = result.items.map((item) => {
        return toSkeletonItem({
          postUri: item.post.uri,
          itemUri: item.repost ? item.repost.uri : item.post.uri,
        })
      })
      return {
        encoding: 'application/json',
        body: {
          feed,
          cursor: result.cursor,
        },
      }
    },
  })
}
