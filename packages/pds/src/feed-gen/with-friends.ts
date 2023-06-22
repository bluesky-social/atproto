import { sql } from 'kysely'
import AppContext from '../context'
import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { paginate } from '../db/pagination'
import { AlgoHandler, AlgoResponse } from './types'
import {
  FeedKeyset,
  getFeedDateThreshold,
} from '../app-view/api/app/bsky/util/feed'
import { FollowCountLevel } from '../app-view/services/graph'
import { FeedItemType } from '../app-view/services/feed'
import { notSoftDeletedClause } from '../db/util'

const handler: AlgoHandler = async (
  ctx: AppContext,
  params: SkeletonParams,
  requester: string,
): Promise<AlgoResponse> => {
  const { cursor, limit = 50 } = params
  const accountService = ctx.services.account(ctx.db)
  const graphService = ctx.services.appView.graph(ctx.db)

  const followCountLevel = await graphService.followCountLevel(requester)
  if (followCountLevel === FollowCountLevel.None) {
    return {
      feedItems: [],
    }
  }

  const { ref } = ctx.db.db.dynamic

  // @NOTE use of getFeedDateThreshold() not currently beneficial to this feed
  const keyset = new FeedKeyset(ref('post.indexedAt'), ref('post.cid'))
  const sortFrom = keyset.unpack(cursor)?.primary

  // @NOTE inlined selectPostQb() to have control over join order
  let postsQb = ctx.db.db
    .selectFrom('post')
    .innerJoin('post_agg', 'post_agg.uri', 'post.uri') // @NOTE careful adjusting join order due to perf
    .innerJoin('repo_root as author_repo', 'author_repo.did', 'post.creator')
    .innerJoin('record', 'record.uri', 'post.uri')
    .where('post_agg.likeCount', '>=', 5)
    .where(notSoftDeletedClause(ref('author_repo')))
    .where(notSoftDeletedClause(ref('record')))
    .whereExists((qb) =>
      qb
        .selectFrom('follow')
        .where('follow.creator', '=', requester)
        .whereRef('follow.subjectDid', '=', 'post.creator'),
    )
    .where((qb) =>
      accountService.whereNotMuted(qb, requester, [ref('post.creator')]),
    )
    .whereNotExists(graphService.blockQb(requester, [ref('post.creator')]))
    .select([
      sql<FeedItemType>`${'post'}`.as('type'),
      'post.uri as uri',
      'post.cid as cid',
      'post.uri as postUri',
      'post.creator as originatorDid',
      'post.creator as postAuthorDid',
      'post.replyParent as replyParent',
      'post.replyRoot as replyRoot',
      'post.indexedAt as sortAt',
    ])

  if (followCountLevel === FollowCountLevel.Low) {
    postsQb = postsQb.where(
      'post.indexedAt',
      '>',
      getFeedDateThreshold(sortFrom),
    )
  }

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
