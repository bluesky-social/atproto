import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { FeedAlgorithm, FeedKeyset, getFeedDateThreshold } from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import Database from '../../../../db'
import { SkeletonFeedPost } from '../../../../lexicon/types/app/bsky/feed/defs'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.authVerifier,
    handler: async ({ params, auth }) => {
      const { algorithm, limit, cursor } = params
      const viewer = auth.credentials.did

      if (algorithm && algorithm !== FeedAlgorithm.ReverseChronological) {
        throw new InvalidRequestError(`Unsupported algorithm: ${algorithm}`)
      }

      const skeleton = await getTimelineSkeleton(ctx.db, viewer, limit, cursor)

      const feedService = ctx.services.feed(ctx.db)
      const feedItems = await feedService.cleanFeedSkeleton(
        skeleton.feed,
        limit,
        viewer,
      )
      const feed = await feedService.hydrateFeed(feedItems, viewer)

      return {
        encoding: 'application/json',
        body: {
          feed,
          cursor: skeleton.cursor,
        },
      }
    },
  })
}

export const getTimelineSkeleton = async (
  db: Database,
  viewer: string,
  limit: number,
  cursor?: string,
): Promise<{ feed: SkeletonFeedPost[]; cursor?: string }> => {
  const { ref } = db.db.dynamic

  const keyset = new FeedKeyset(ref('feed_item.sortAt'), ref('feed_item.cid'))
  const sortFrom = keyset.unpack(cursor)?.primary

  let followQb = db.db
    .selectFrom('feed_item')
    .innerJoin('follow', 'follow.subjectDid', 'feed_item.originatorDid')
    .where('follow.creator', '=', viewer)
    .innerJoin('post', 'post.uri', 'feed_item.postUri')
    .where('feed_item.sortAt', '>', getFeedDateThreshold(sortFrom, 1))
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

  let selfQb = db.db
    .selectFrom('feed_item')
    .innerJoin('post', 'post.uri', 'feed_item.postUri')
    .where('feed_item.originatorDid', '=', viewer)
    .where('feed_item.sortAt', '>', getFeedDateThreshold(sortFrom, 1))
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
    cursor: keyset.packFromResult(feedItems),
    feed,
  }
}
