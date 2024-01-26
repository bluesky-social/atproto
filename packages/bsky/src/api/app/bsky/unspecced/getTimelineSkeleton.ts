import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { skeleton } from '../feed/getTimeline'
import { toSkeletonItem } from '../../../../feed-gen/types'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getTimelineSkeleton({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      const db = ctx.db.getReplica('timeline')
      const feedService = ctx.services.feed(db)
      const viewer = auth.credentials.iss

      // @NOTE bad cursor during appview swap handled within skeleton()
      const result = await skeleton({ ...params, viewer }, { db, feedService })

      return {
        encoding: 'application/json',
        body: {
          feed: result.feedItems.map(toSkeletonItem),
          cursor: result.cursor,
        },
      }
    },
  })
}
