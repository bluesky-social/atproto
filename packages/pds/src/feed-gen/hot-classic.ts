import AppContext from '../context'
import { NotEmptyArray } from '@atproto/common'
import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { paginate } from '../db/pagination'
import { AlgoHandler, AlgoResponse } from './types'
import { FeedKeyset } from '../app-view/api/app/bsky/util/feed'

const NO_WHATS_HOT_LABELS: NotEmptyArray<string> = [
  '!no-promote',
  'corpse',
  'self-harm',
  'porn',
  'sexual',
  'nudity',
  'underwear',
]

const handler: AlgoHandler = async (
  ctx: AppContext,
  params: SkeletonParams,
  requester: string,
): Promise<AlgoResponse> => {
  const { limit = 50, cursor } = params
  const accountService = ctx.services.account(ctx.db)
  const feedService = ctx.services.appView.feed(ctx.db)
  const graphService = ctx.services.appView.graph(ctx.db)

  const { ref } = ctx.db.db.dynamic

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
        .where('val', 'in', NO_WHATS_HOT_LABELS)
        .where('neg', '=', 0)
        .where((clause) =>
          clause
            .whereRef('label.uri', '=', ref('post.creator'))
            .orWhereRef('label.uri', '=', ref('post.uri'))
            .orWhereRef('label.uri', '=', ref('post_embed_record.embedUri')),
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
