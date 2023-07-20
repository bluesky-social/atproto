import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { FeedKeyset, getFeedDateThreshold } from '../util/feed'
import { paginate } from '../../../../db/pagination'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getTimelineSkeleton({
    auth: ctx.authVerifier,
    handler: async ({ auth, params }) => {
      const { limit, cursor } = params
      const viewer = auth.credentials.did

      const db = ctx.db.db
      const { ref } = db.dynamic

      const graphService = ctx.services.graph(ctx.db)

      const keyset = new FeedKeyset(
        ref('feed_item.sortAt'),
        ref('feed_item.cid'),
      )
      const sortFrom = keyset.unpack(cursor)?.primary

      let followQb = ctx.db.db
        .selectFrom('feed_item')
        .innerJoin('follow', 'follow.subjectDid', 'feed_item.originatorDid')
        .innerJoin('post', 'post.uri', 'feed_item.postUri')
        .where('follow.creator', '=', viewer)
        .where((qb) =>
          // Hide posts and reposts of or by muted actors
          graphService.whereNotMuted(qb, viewer, [
            ref('post.creator'),
            ref('originatorDid'),
          ]),
        )
        .whereNotExists(
          graphService.blockQb(viewer, [
            ref('post.creator'),
            ref('originatorDid'),
          ]),
        )
        .where('feed_item.sortAt', '>', getFeedDateThreshold(sortFrom))
        .selectAll('feed_item')
        .select([
          'post.replyRoot',
          'post.replyParent',
          'post.creator as postAuthorDid',
        ])

      followQb = paginate(followQb, {
        limit,
        cursor,
        keyset,
        tryIndex: true,
      })

      let selfQb = ctx.db.db
        .selectFrom('feed_item')
        .innerJoin('post', 'post.uri', 'feed_item.postUri')
        .where('feed_item.originatorDid', '=', viewer)
        .where((qb) =>
          // Hide posts and reposts of or by muted actors
          graphService.whereNotMuted(qb, viewer, [
            ref('post.creator'),
            ref('originatorDid'),
          ]),
        )
        .whereNotExists(
          graphService.blockQb(viewer, [
            ref('post.creator'),
            ref('originatorDid'),
          ]),
        )
        .where('feed_item.sortAt', '>', getFeedDateThreshold(sortFrom))
        .selectAll('feed_item')
        .select([
          'post.replyRoot',
          'post.replyParent',
          'post.creator as postAuthorDid',
        ])

      selfQb = paginate(selfQb, {
        limit: Math.min(limit, 10),
        cursor,
        keyset,
        tryIndex: true,
      })

      const [followRes, selfRes] = await Promise.all([
        followQb.execute(),
        selfQb.execute(),
      ])

      const feedItems = [...followRes, ...selfRes]
        .sort((a, b) => {
          if (a.sortAt > b.sortAt) return -1
          if (a.sortAt < b.sortAt) return 1
          return a.cid > b.cid ? -1 : 1
        })
        .slice(0, limit)

      const feed = feedItems.map((item) => ({
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
          cursor: keyset.packFromResult(feedItems),
          feed,
        },
      }
    },
  })
}
