import { NotEmptyArray } from '@atproto/common'
import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import AppContext from '../context'
import { paginate } from '../db/pagination'
import { AlgoHandler, AlgoResponse } from './types'
import { FeedKeyset } from '../app-view/api/app/bsky/util/feed'

const BSKY_TEAM: NotEmptyArray<string> = [
  'did:plc:oky5czdrnfjpqslsw2a5iclo', // jay
  'did:plc:yk4dd2qkboz2yv6tpubpc6co', // daniel
  'did:plc:ragtjsm2j2vknwkz3zp4oxrd', // paul
  'did:plc:l3rouwludahu3ui3bt66mfvj', // devin
  'did:plc:tpg43qhh4lw4ksiffs4nbda3', // jake
  'did:plc:44ybard66vv44zksje25o7dz', // bryan
  'did:plc:qjeavhlw222ppsre4rscd3n2', // rose
  'did:plc:vjug55kidv6sye7ykr5faxxn', // emily
  'did:plc:fgsn4gf2dlgnybo4nbej5b2s', // ansh
  'did:plc:vpkhqolt662uhesyj6nxm7ys', // why
  'did:plc:z72i7hdynmk6r22z27h6tvur', // @bsky.app
  'did:plc:ewvi7nxzyoun6zhxrhs64oiz', // @atproto.com
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
