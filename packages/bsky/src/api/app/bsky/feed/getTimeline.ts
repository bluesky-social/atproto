import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { FeedAlgorithm, FeedKeyset, getFeedDateThreshold } from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { Database } from '../../../../db'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getTimeline'
import { setRepoRev } from '../../../util'
import {
  FeedHydrationState,
  FeedRow,
  FeedService,
} from '../../../../services/feed'
import { createPipeline } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getTimeline = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.app.bsky.feed.getTimeline({
    auth: ctx.authVerifier,
    handler: async ({ params, auth, res }) => {
      const viewer = auth.credentials.did
      const db = ctx.db.getReplica('timeline')
      const feedService = ctx.services.feed(db)
      const actorService = ctx.services.actor(db)

      const [result, repoRev] = await Promise.all([
        getTimeline({ ...params, viewer }, { db, feedService }),
        actorService.getRepoRev(viewer),
      ])

      setRepoRev(res, repoRev)

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

export const skeleton = async (
  params: Params,
  ctx: Context,
): Promise<SkeletonState> => {
  const { cursor, limit, algorithm, viewer } = params
  const { db } = ctx
  const { ref } = db.db.dynamic

  if (algorithm && algorithm !== FeedAlgorithm.ReverseChronological) {
    throw new InvalidRequestError(`Unsupported algorithm: ${algorithm}`)
  }

  const keyset = new FeedKeyset(ref('feed_item.sortAt'), ref('feed_item.cid'))
  const sortFrom = keyset.unpack(cursor)?.primary

  let followQb = db.db
    .selectFrom('feed_item')
    .innerJoin('follow', 'follow.subjectDid', 'feed_item.originatorDid')
    .where('follow.creator', '=', viewer)
    .innerJoin('post', 'post.uri', 'feed_item.postUri')
    .where('feed_item.sortAt', '>', getFeedDateThreshold(sortFrom, 2))
    .selectAll('feed_item')
    .select([
      'post.replyRoot',
      'post.replyParent',
      'post.creator as postAuthorDid',
    ])

  followQb = paginate(followQb, {
    limit,
    cursor,
    keyset,
    tryIndex: true,
  })

  let selfQb = db.db
    .selectFrom('feed_item')
    .innerJoin('post', 'post.uri', 'feed_item.postUri')
    .where('feed_item.originatorDid', '=', viewer)
    .where('feed_item.sortAt', '>', getFeedDateThreshold(sortFrom, 2))
    .selectAll('feed_item')
    .select([
      'post.replyRoot',
      'post.replyParent',
      'post.creator as postAuthorDid',
    ])

  selfQb = paginate(selfQb, {
    limit: Math.min(limit, 10),
    cursor,
    keyset,
    tryIndex: true,
  })

  const [followRes, selfRes] = await Promise.all([
    followQb.execute(),
    selfQb.execute(),
  ])

  const feedItems: FeedRow[] = [...followRes, ...selfRes]
    .sort((a, b) => {
      if (a.sortAt > b.sortAt) return -1
      if (a.sortAt < b.sortAt) return 1
      return a.cid > b.cid ? -1 : 1
    })
    .slice(0, limit)

  return {
    params,
    feedItems,
    cursor: keyset.packFromResult(feedItems),
  }
}

const hydration = async (
  state: SkeletonState,
  ctx: Context,
): Promise<HydrationState> => {
  const { feedService } = ctx
  const { params, feedItems } = state
  const refs = feedService.feedItemRefs(feedItems)
  const hydrated = await feedService.feedHydration({
    ...refs,
    viewer: params.viewer,
  })
  return { ...state, ...hydrated }
}

const noBlocksOrMutes = (state: HydrationState): HydrationState => {
  const { viewer } = state.params
  state.feedItems = state.feedItems.filter(
    (item) =>
      !state.bam.block([viewer, item.postAuthorDid]) &&
      !state.bam.block([viewer, item.originatorDid]) &&
      !state.bam.mute([viewer, item.postAuthorDid]) &&
      !state.bam.mute([viewer, item.originatorDid]),
  )
  return state
}

const presentation = (state: HydrationState, ctx: Context) => {
  const { feedService } = ctx
  const { feedItems, cursor, params } = state
  const feed = feedService.views.formatFeed(feedItems, state, {
    viewer: params.viewer,
  })
  return { feed, cursor }
}

type Context = {
  db: Database
  feedService: FeedService
}

type Params = QueryParams & { viewer: string }

type SkeletonState = {
  params: Params
  feedItems: FeedRow[]
  cursor?: string
}

type HydrationState = SkeletonState & FeedHydrationState
