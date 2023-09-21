import AppContext from '../context'
import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AlgoHandler, AlgoResponse } from './types'

const handler: AlgoHandler = async (
  _ctx: AppContext,
  _params: SkeletonParams,
  _requester: string,
): Promise<AlgoResponse> => {
  // Temporary change to only return a post notifying users that the feed is down
  return {
    feedItems: [
      {
        type: 'post',
        uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3jzinucnmbi2c',
        cid: 'bafyreifmtn55tubbv7tefrq277nzfy4zu7ioithky276aho5ehb6w3nu6q',
        postUri:
          'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3jzinucnmbi2c',
        postAuthorDid: 'did:plc:z72i7hdynmk6r22z27h6tvur',
        originatorDid: 'did:plc:z72i7hdynmk6r22z27h6tvur',
        replyParent: null,
        replyRoot: null,
        sortAt: '2023-07-01T23:04:27.853Z',
      },
    ],
  }
  // const { cursor, limit = 50 } = params
  // const accountService = ctx.services.account(ctx.db)
  // const feedService = ctx.services.appView.feed(ctx.db)
  // const graphService = ctx.services.appView.graph(ctx.db)

  // const { ref } = ctx.db.db.dynamic

  // const keyset = new FeedKeyset(ref('post.indexedAt'), ref('post.cid'))
  // const sortFrom = keyset.unpack(cursor)?.primary

  // let postsQb = feedService
  //   .selectPostQb()
  //   // .innerJoin('post_agg', 'post_agg.uri', 'post.uri')
  //   // .where('post_agg.likeCount', '>=', 6)
  //   .whereExists((qb) =>
  //     qb
  //       .selectFrom('follow')
  //       .where('follow.creator', '=', requester)
  //       .whereRef('follow.subjectDid', '=', 'post.creator'),
  //   )
  //   .where((qb) =>
  //     accountService.whereNotMuted(qb, requester, [ref('post.creator')]),
  //   )
  //   .whereNotExists(graphService.blockQb(requester, [ref('post.creator')]))
  //   .where('post.indexedAt', '>', getFeedDateThreshold(sortFrom))

  // postsQb = paginate(postsQb, { limit, cursor, keyset, tryIndex: true })

  // const feedItems = await postsQb.execute()
  // return {
  //   feedItems,
  //   cursor: keyset.packFromResult(feedItems),
  // }
}

export default handler
