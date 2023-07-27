import { NotEmptyArray } from '@atproto/common'
import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import AppContext from '../context'
import { paginate } from '../db/pagination'
import { AlgoHandler, AlgoResponse } from './types'
import { FeedKeyset } from '../app-view/api/app/bsky/util/feed'

const BSKY_TEAM: NotEmptyArray<string> = [
  'did:plc:z72i7hdynmk6r22z27h6tvur', // @bsky.app
  'did:plc:ewvi7nxzyoun6zhxrhs64oiz', // @atproto.com
  'did:plc:eon2iu7v3x2ukgxkqaf7e5np', // @safety.bsky.app
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
    .where('post.creator', 'in', BSKY_TEAM)
    .where((qb) =>
      accountService.whereNotMuted(qb, requester, [ref('post.creator')]),
    )
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
