import AppContext from '../context'
import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
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

  const { cursor, limit = 50 } = params
  const db = ctx.db.getReplica('feed')
  const feedService = ctx.services.feed(db)
  const { ref } = db.db.dynamic

  const keyset = new FeedKeyset(ref('post.sortAt'), ref('post.cid'))
  const sortFrom = keyset.unpack(cursor)?.primary

  let postsQb = feedService
    .selectPostQb()
    .innerJoin('follow', 'follow.subjectDid', 'post.creator')
    .innerJoin('post_agg', 'post_agg.uri', 'post.uri')
    .where('post_agg.likeCount', '>=', 5)
    .where('follow.creator', '=', viewer)
    .where('post.sortAt', '>', getFeedDateThreshold(sortFrom))

  postsQb = paginate(postsQb, { limit, cursor, keyset, tryIndex: true })

  const feedItems = await postsQb.execute()

  return {
    feedItems,
    cursor: keyset.packFromResult(feedItems),
  }
}

export default handler
