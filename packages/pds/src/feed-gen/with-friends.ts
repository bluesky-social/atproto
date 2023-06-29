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

  const keyset = new FeedKeyset(ref('post.indexedAt'), ref('post.cid'))
  const sortFrom = keyset.unpack(cursor)?.primary

  let postsQb = feedService
    .selectPostQb()
    .innerJoin('post_agg', 'post_agg.uri', 'post.uri')
    .where('post_agg.likeCount', '>=', 5)
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
    .where('post.indexedAt', '>', getFeedDateThreshold(sortFrom))

  postsQb = paginate(postsQb, { limit, cursor, keyset, tryIndex: true })

  const feedItems = await postsQb.execute()
  return {
    feedItems,
    cursor: keyset.packFromResult(feedItems),
  }
}

export default handler
