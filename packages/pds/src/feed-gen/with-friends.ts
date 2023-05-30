import AppContext from '../context'
import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { paginate } from '../db/pagination'
import { AlgoHandler, AlgoResponse } from './types'
import {
  FeedKeyset,
  getFeedDateThreshold,
} from '../app-view/api/app/bsky/util/feed'

const handler: AlgoHandler = async (
  ctx: AppContext,
  params: SkeletonParams,
  requester: string,
): Promise<AlgoResponse> => {
  const { cursor, limit = 50 } = params
  const accountService = ctx.services.account(ctx.db)
  const feedService = ctx.services.appView.feed(ctx.db)
  const graphService = ctx.services.appView.graph(ctx.db)

  const { ref } = ctx.db.db.dynamic

  const keyset = new FeedKeyset(ref('feed_item.sortAt'), ref('feed_item.cid'))
  const sortFrom = keyset.unpack(cursor)?.primary

  let postsQb = feedService
    .selectFeedItemQb()
    .innerJoin('post_agg', 'post_agg.uri', 'feed_item.uri')
    .where('feed_item.type', '=', 'post')
    .where('post_agg.likeCount', '>=', 5)
    .whereExists((qb) =>
      qb
        .selectFrom('follow')
        .where('follow.creator', '=', requester)
        .whereRef('follow.subjectDid', '=', 'originatorDid'),
    )
    .where((qb) =>
      accountService.whereNotMuted(qb, requester, [ref('post.creator')]),
    )
    .whereNotExists(graphService.blockQb(requester, [ref('post.creator')]))
    .where('feed_item.sortAt', '>', getFeedDateThreshold(sortFrom))

  postsQb = paginate(postsQb, { limit, cursor, keyset })

  const feedItems = await postsQb.execute()
  return {
    feedItems,
    cursor: keyset.packFromResult(feedItems),
  }
}

export default handler

// Original algorithm, temporarily disabled because of performance issues
// --------------------------

// const postRate = sql`(10000 * ${ref('postsCount')} / extract(epoch from ${ref(
//   'user_account.createdAt',
// )}::timestamp))`
// const mostActiveMutuals = await ctx.db.db
//   .selectFrom('follow')
//   .select('subjectDid as did')
//   .innerJoin('user_account', 'user_account.did', 'follow.subjectDid')
//   .innerJoin('profile_agg', 'profile_agg.did', 'follow.subjectDid')
//   .where('follow.creator', '=', requester)
//   .whereExists((qb) =>
//     qb
//       .selectFrom('follow as mutual')
//       .where('mutual.subjectDid', '=', requester)
//       .whereRef('mutual.creator', '=', 'follow.subjectDid'),
//   )
//   .orderBy(postRate, 'desc')
//   .limit(25)
//   .execute()

// if (!mostActiveMutuals.length) {
//   return { feedItems: [] }
// }

// // All posts that hit a certain threshold of likes and also have
// // at least one like by one of your most active mutuals.
// let postsQb = feedService
//   .selectFeedItemQb()
//   .innerJoin('post_agg', 'post_agg.uri', 'feed_item.uri')
//   .where('feed_item.type', '=', 'post')
//   .where('post_agg.likeCount', '>=', 5)
//   .whereExists((qb) => {
//     return qb
//       .selectFrom('like')
//       .whereRef('like.subject', '=', 'post.uri')
//       .whereRef(
//         'like.creator',
//         'in',
//         valuesList(mostActiveMutuals.map((follow) => follow.did)),
//       )
//   })
//   .where((qb) =>
//     accountService.whereNotMuted(qb, requester, [ref('post.creator')]),
//   )
//   .whereNotExists(graphService.blockQb(requester, [ref('post.creator')]))
