import { NotEmptyArray } from '@atproto/common'
import { QueryParams as SkeletonParams } from '@atproto/api/src/client/types/app/bsky/feed/getFeedSkeleton'
import AppContext from '../../../../../../context'
import { FeedKeyset } from '../../util/feed'
import { paginate } from '../../../../../../db/pagination'
import { AlgoHandler, AlgoResponse } from './types'

const BSKY_TEAM: NotEmptyArray<string> = ['did:example:test']

const handler: AlgoHandler = async (
  ctx: AppContext,
  params: SkeletonParams,
  requester: string,
): Promise<AlgoResponse> => {
  const { limit, cursor } = params
  const accountService = ctx.services.account(ctx.db)
  const feedService = ctx.services.appView.feed(ctx.db)
  const graphService = ctx.services.appView.graph(ctx.db)

  const { ref } = ctx.db.db.dynamic

  const postsQb = feedService
    .selectPostQb()
    .where('post.creator', 'in', BSKY_TEAM)
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
