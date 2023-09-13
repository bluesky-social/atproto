import { NotEmptyArray } from '@atproto/common'
import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import AppContext from '../context'
import { paginate } from '../db/pagination'
import { AlgoHandler, AlgoResponse } from './types'
import { FeedKeyset } from '../api/app/bsky/util/feed'

const BSKY_TEAM: NotEmptyArray<string> = [
  'did:plc:z72i7hdynmk6r22z27h6tvur', // @bsky.app
  'did:plc:ewvi7nxzyoun6zhxrhs64oiz', // @atproto.com
  'did:plc:eon2iu7v3x2ukgxkqaf7e5np', // @safety.bsky.app
]

const handler: AlgoHandler = async (
  ctx: AppContext,
  params: SkeletonParams,
  _viewer: string,
): Promise<AlgoResponse> => {
  const { limit = 50, cursor } = params
  const db = ctx.db.getReplica('feed')
  const feedService = ctx.services.feed(db)

  const { ref } = db.db.dynamic

  const postsQb = feedService
    .selectPostQb()
    .where('post.creator', 'in', BSKY_TEAM)

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
