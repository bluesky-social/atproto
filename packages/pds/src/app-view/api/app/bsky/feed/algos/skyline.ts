import AppContext from '../../../../../../context'
import { QueryParams as SkeletonParams } from '@atproto/api/src/client/types/app/bsky/feed/getFeedSkeleton'
import { FeedKeyset } from '../../util/feed'
import { paginate } from '../../../../../../db/pagination'
import { countAll } from '../../../../../../db/util'
import { AlgoHandler, AlgoResponse } from './types'

const handler: AlgoHandler = async (
  ctx: AppContext,
  params: SkeletonParams,
  requester: string,
): Promise<AlgoResponse> => {
  const { cursor, limit } = params
  const accountService = ctx.services.account(ctx.db)
  const feedService = ctx.services.appView.feed(ctx.db)
  const graphService = ctx.services.appView.graph(ctx.db)

  const { ref } = ctx.db.db.dynamic

  const postsQb = feedService
    .selectFeedItemQb()
    .leftJoin('post_agg', 'post_agg.uri', 'post.uri')
    .where((qb) =>
      qb
        // select all posts/reposts from a follow that have >= 5 likes
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
            .where('post_agg.likeCount', '>=', 5),
        )
        // and all posts from the network that have >= 5 likes from *your* follows
        .orWhere((fromAll) =>
          fromAll.where('feed_item.type', '=', 'post').where(
            (qb) =>
              qb
                .selectFrom('like')
                .where('like.subject', '=', 'post.uri')
                .whereExists((qbInner) =>
                  qbInner
                    .selectFrom('follow')
                    .where('follow.creator', '=', requester)
                    .whereRef('follow.subjectDid', '=', ref('like.creator')),
                )
                .select(countAll.as('count')),
            '>=',
            5,
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
