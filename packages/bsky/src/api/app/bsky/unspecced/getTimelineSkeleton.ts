import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import AppContext from '../../../../context'
import { skeleton } from '../feed/getTimeline'
import { toSkeletonItem } from '../../../feed-gen/types'
import { urisByCollection } from '../../../../hydration/util'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getTimelineSkeleton({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      const viewer = auth.credentials.iss
      const result = await skeleton({ ctx, params: { ...params, viewer } })
      const collections = urisByCollection(result.uris)
      const reposts = await ctx.hydrator.feed.getReposts(
        collections.get(ids.AppBskyFeedRepost) ?? [],
      )
      const feed = result.uris.map((uri) => {
        const repost = reposts.get(uri)
        return toSkeletonItem({
          itemUri: uri,
          postUri: repost ? repost.record.subject.uri : uri,
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
