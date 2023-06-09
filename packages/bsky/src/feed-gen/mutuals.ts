import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import AppContext from '../context'
import { paginate } from '../db/pagination'
import { AlgoHandler, AlgoResponse } from './types'
import { FeedKeyset, getFeedDateThreshold } from '../api/app/bsky/util/feed'

const handler: AlgoHandler = async (
  ctx: AppContext,
  params: SkeletonParams,
  requester: string,
): Promise<AlgoResponse> => {
  const { limit = 50, cursor } = params
  const feedService = ctx.services.feed(ctx.db)

  const { ref } = ctx.db.db.dynamic

  const mutualsSubquery = ctx.db.db
    .selectFrom('follow')
    .where('follow.creator', '=', requester)
    .whereExists((qb) =>
      qb
        .selectFrom('follow as follow_inner')
        .whereRef('follow_inner.creator', '=', 'follow.subjectDid')
        .where('follow_inner.subjectDid', '=', requester)
        .selectAll(),
    )
    .select('follow.subjectDid')

  const keyset = new FeedKeyset(ref('feed_item.sortAt'), ref('feed_item.cid'))
  const sortFrom = keyset.unpack(cursor)?.primary

  // @TODO apply blocks and mutes
  let feedQb = feedService
    .selectFeedItemQb()
    .where('feed_item.type', '=', 'post') // ensures originatorDid is post.creator
    .where((qb) =>
      qb
        .where('originatorDid', '=', requester)
        .orWhere('originatorDid', 'in', mutualsSubquery),
    )
    .where('feed_item.sortAt', '>', getFeedDateThreshold(sortFrom))

  feedQb = paginate(feedQb, { limit, cursor, keyset })

  const feedItems = await feedQb.execute()
  return {
    feedItems,
    cursor: keyset.packFromResult(feedItems),
  }
}

export default handler
