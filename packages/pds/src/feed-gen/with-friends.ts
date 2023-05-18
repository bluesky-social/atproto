import AppContext from '../context'
import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { paginate } from '../db/pagination'
import { countAll } from '../db/util'
import { AlgoHandler, AlgoResponse } from './types'
import { FeedKeyset } from '../app-view/api/app/bsky/util/feed'

const handler: AlgoHandler = async (
  ctx: AppContext,
  params: SkeletonParams,
  requester: string,
): Promise<AlgoResponse> => {
  const { cursor, limit = 50 } = params
  const accountService = ctx.services.account(ctx.db)
  const feedService = ctx.services.appView.feed(ctx.db)
  const graphService = ctx.services.appView.graph(ctx.db)

  const followCountRes = await ctx.db.db
    .selectFrom('follow')
    .where('follow.creator', '=', requester)
    .select(countAll.as('count'))
    .executeTakeFirst()

  const followCount = followCountRes?.count ?? 0
  // total follows/100, with a minimum of 2 & a max of 8
  const likeThreshold = Math.max(Math.min(Math.floor(followCount / 100), 8), 2)

  const { ref } = ctx.db.db.dynamic

  const postsQb = feedService
    .selectFeedItemQb()
    .leftJoin('post_agg', 'post_agg.uri', 'post.uri')
    .where((qb) =>
      qb
        // select all posts/reposts from a follow that have >= threshold likes
        .where((fromFollows) =>
          fromFollows
            .where((followsInner) =>
              followsInner
                .where('originatorDid', '=', requester)
                .orWhereExists((qb) =>
                  qb
                    .selectFrom('follow')
                    .where('follow.creator', '=', requester)
                    .whereRef('follow.subjectDid', '=', ref('originatorDid')),
                ),
            )
            .where('post_agg.likeCount', '>=', likeThreshold),
        )
        // and all posts from the network that have >= threshold likes from *your* follows
        .orWhere((fromAll) =>
          fromAll.where('feed_item.type', '=', 'post').where(
            (qb) =>
              qb
                .selectFrom('like')
                .whereRef('like.subject', '=', 'post.uri')
                .whereExists((qbInner) =>
                  qbInner
                    .selectFrom('follow')
                    .where('follow.creator', '=', requester)
                    .whereRef('follow.subjectDid', '=', 'like.creator'),
                )
                .select(countAll.as('count')),
            '>=',
            likeThreshold,
          ),
        ),
    )
    .whereNotExists(accountService.mutedQb(requester, [ref('post.creator')]))
    .whereNotExists(graphService.blockQb(requester, [ref('post.creator')]))

  const keyset = new FeedKeyset(ref('sortAt'), ref('cid'))

  let feedQb = ctx.db.db.selectFrom(postsQb.as('feed_items')).selectAll()
  feedQb = paginate(feedQb, { limit, cursor, keyset })

  const feedItems = await feedQb.execute()
  return {
    feedItems,
    cursor: keyset.packFromResult(feedItems),
  }
}

export default handler
