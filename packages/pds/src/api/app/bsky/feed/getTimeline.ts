import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import {
  FeedAlgorithm,
  FeedItemType,
  FeedKeyset,
  composeFeed,
  FeedRow,
} from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { algorithm, limit, before } = params
      const db = ctx.db.db
      const { ref } = db.dynamic
      const requester = auth.credentials.did

      if (algorithm && algorithm !== FeedAlgorithm.ReverseChronological) {
        throw new InvalidRequestError(`Unsupported algorithm: ${algorithm}`)
      }

      const followingIdsSubquery = db
        .selectFrom('follow')
        .select('follow.subjectDid')
        .where('follow.creator', '=', requester)

      const postsQb = db
        .selectFrom('post')
        .select([
          sql<FeedItemType>`${'post'}`.as('type'),
          'uri as postUri',
          'cid as postCid',
          'creator as originatorDid',
          'creator as authorDid',
          'replyParent',
          'replyRoot',
          'indexedAt as cursor',
        ])
        .where('creator', '=', requester)
        .orWhere('creator', 'in', followingIdsSubquery)

      const repostsQb = db
        .selectFrom('repost')
        .innerJoin('post', 'post.uri', 'repost.subject')
        .select([
          sql<FeedItemType>`${'repost'}`.as('type'),
          'post.uri as postUri',
          'post.cid as postCid',
          'creator as originatorDid',
          'post.creator as authorDid',
          'post.replyParent as replyParent',
          'post.replyRoot as replyRoot',
          'indexedAt as cursor',
        ])
        .where('creator', '=', requester)
        .orWhere('creator', 'in', followingIdsSubquery)

      const trendsQb = db
        .selectFrom('trend')
        .innerJoin('post', 'post.uri', 'trend.subject')
        .select([
          sql<FeedItemType>`${'trend'}`.as('type'),
          'post.uri as postUri',
          'post.cid as postCid',
          'creator as originatorDid',
          'post.creator as authorDid',
          'post.replyParent as replyParent',
          'post.replyRoot as replyRoot',
          'indexedAt as cursor',
        ])
        .where('creator', '=', requester)
        .orWhere('creator', 'in', followingIdsSubquery)

      const keyset = new FeedKeyset(ref('cursor'), ref('postCid'))
      let feedItemsQb = db
        .selectFrom(postsQb.union(repostsQb).union(trendsQb).as('feed_items'))
        .selectAll()
      feedItemsQb = paginate(feedItemsQb, {
        limit,
        before,
        keyset,
      })
      const feedItems: FeedRow[] = await feedItemsQb.execute()
      const feed = await composeFeed(
        db,
        ctx.imgUriBuilder,
        feedItems,
        requester,
      )

      return {
        encoding: 'application/json',
        body: {
          feed,
          cursor: keyset.packFromResult(feedItems),
        },
      }
    },
  })
}
