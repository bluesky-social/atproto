import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import AppContext from '../context'
import { paginate } from '../db/pagination'
import { AlgoHandler, AlgoResponse } from './types'
import { FeedKeyset, getFeedDateThreshold } from '../api/app/bsky/util/feed'
import { AuthRequiredError } from '@atproto/xrpc-server'

const handler: AlgoHandler = async (
  ctx: AppContext,
  params: SkeletonParams,
  viewer: string | null,
): Promise<AlgoResponse> => {
  if (!viewer) {
    throw new AuthRequiredError('This feed requires being logged-in')
  }

  const { limit = 50, cursor } = params
  const db = ctx.db.getReplica('feed')
  const feedService = ctx.services.feed(db)
  const { ref } = db.db.dynamic

  const mutualsSubquery = db.db
    .selectFrom('follow')
    .where('follow.creator', '=', viewer)
    .whereExists((qb) =>
      qb
        .selectFrom('follow as follow_inner')
        .whereRef('follow_inner.creator', '=', 'follow.subjectDid')
        .where('follow_inner.subjectDid', '=', viewer)
        .selectAll(),
    )
    .select('follow.subjectDid')

  const keyset = new FeedKeyset(ref('feed_item.sortAt'), ref('feed_item.cid'))
  const sortFrom = keyset.unpack(cursor)?.primary

  let feedQb = feedService
    .selectFeedItemQb()
    .where('feed_item.type', '=', 'post') // ensures originatorDid is post.creator
    .where((qb) =>
      qb
        .where('originatorDid', '=', viewer)
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
