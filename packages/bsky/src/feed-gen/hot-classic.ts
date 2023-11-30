import AppContext from '../context'
import { NotEmptyArray } from '@atproto/common'
import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { paginate } from '../db/pagination'
import { AlgoHandler, AlgoResponse } from './types'
import { FeedKeyset } from '../api/app/bsky/util/feed'
import { valuesList } from '../db/util'

const NO_WHATS_HOT_LABELS: NotEmptyArray<string> = ['!no-promote']

const handler: AlgoHandler = async (
  ctx: AppContext,
  params: SkeletonParams,
  _viewer: string | null,
): Promise<AlgoResponse> => {
  const { limit = 50, cursor } = params
  const db = ctx.db.getReplica('feed')
  const feedService = ctx.services.feed(db)

  const { ref } = db.db.dynamic

  const postsQb = feedService
    .selectPostQb()
    .leftJoin('post_agg', 'post_agg.uri', 'post.uri')
    .leftJoin('post_embed_record', 'post_embed_record.postUri', 'post.uri')
    .where('post_agg.likeCount', '>=', 12)
    .where('post.replyParent', 'is', null)
    .whereNotExists((qb) =>
      qb
        .selectFrom('label')
        .selectAll()
        .whereRef('val', 'in', valuesList(NO_WHATS_HOT_LABELS))
        .where('neg', '=', false)
        .where((clause) =>
          clause
            .whereRef('label.uri', '=', ref('post.creator'))
            .orWhereRef('label.uri', '=', ref('post.uri'))
            .orWhereRef('label.uri', '=', ref('post_embed_record.embedUri')),
        ),
    )

  const keyset = new FeedKeyset(ref('sortAt'), ref('cid'))

  let feedQb = db.db.selectFrom(postsQb.as('feed_items')).selectAll()
  feedQb = paginate(feedQb, { limit, cursor, keyset })

  const feedItems = await feedQb.execute()

  return {
    feedItems,
    cursor: keyset.packFromResult(feedItems),
  }
}

export default handler
