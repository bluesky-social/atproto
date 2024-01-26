import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getAuthorFeed'
import { FeedKeyset } from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { setRepoRev } from '../../../util'
import { Database } from '../../../../db'
import {
  FeedHydrationState,
  FeedRow,
  FeedService,
} from '../../../../services/feed'
import { ActorService } from '../../../../services/actor'
import { GraphService } from '../../../../services/graph'
import { createPipeline } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getAuthorFeed = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutedReposts,
    presentation,
  )
  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth, res }) => {
      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const feedService = ctx.services.feed(db)
      const graphService = ctx.services.graph(db)
      const { viewer } = ctx.authVerifier.parseCreds(auth)

      const [result, repoRev] = await Promise.all([
        getAuthorFeed(
          { ...params, viewer },
          { db, actorService, feedService, graphService },
        ),
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
  const { cursor, limit, actor, filter, viewer } = params
  const { db, actorService, feedService, graphService } = ctx
  const { ref } = db.db.dynamic

  // maybe resolve did first
  const actorRes = await actorService.getActor(actor)
  if (!actorRes) {
    throw new InvalidRequestError('Profile not found')
  }
  const actorDid = actorRes.did

  // verify there is not a block between requester & subject
  if (viewer !== null) {
    const blocks = await graphService.getBlockState([[viewer, actorDid]])
    if (blocks.blocking([viewer, actorDid])) {
      throw new InvalidRequestError(
        `Requester has blocked actor: ${actor}`,
        'BlockedActor',
      )
    }
    if (blocks.blockedBy([viewer, actorDid])) {
      throw new InvalidRequestError(
        `Requester is blocked by actor: $${actor}`,
        'BlockedByActor',
      )
    }
  }

  if (FeedKeyset.clearlyBad(cursor)) {
    return { params, feedItems: [] }
  }

  // defaults to posts, reposts, and replies
  let feedItemsQb = feedService
    .selectFeedItemQb()
    .where('originatorDid', '=', actorDid)

  if (filter === 'posts_with_media') {
    feedItemsQb = feedItemsQb
      // only your own posts
      .where('type', '=', 'post')
      // only posts with media
      .whereExists((qb) =>
        qb
          .selectFrom('post_embed_image')
          .select('post_embed_image.postUri')
          .whereRef('post_embed_image.postUri', '=', 'feed_item.postUri'),
      )
  } else if (filter === 'posts_no_replies') {
    feedItemsQb = feedItemsQb.where((qb) =>
      qb.where('post.replyParent', 'is', null).orWhere('type', '=', 'repost'),
    )
  } else if (filter === 'posts_and_author_threads') {
    feedItemsQb = feedItemsQb.where((qb) =>
      qb
        .where('type', '=', 'repost')
        .orWhere('post.replyParent', 'is', null)
        .orWhere('post.replyRoot', 'like', `at://${actorDid}/%`),
    )
  }

  const keyset = new FeedKeyset(ref('feed_item.sortAt'), ref('feed_item.cid'))

  feedItemsQb = paginate(feedItemsQb, {
    limit,
    cursor,
    keyset,
  })

  const feedItems = await feedItemsQb.execute()

  return {
    params,
    feedItems,
    cursor: keyset.packFromResult(feedItems),
  }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const { feedService } = ctx
  const { params, feedItems } = state
  const refs = feedService.feedItemRefs(feedItems)
  const hydrated = await feedService.feedHydration({
    ...refs,
    viewer: params.viewer,
  })
  return { ...state, ...hydrated }
}

const noBlocksOrMutedReposts = (state: HydrationState) => {
  const { viewer } = state.params
  state.feedItems = state.feedItems.filter((item) => {
    if (!viewer) return true
    return (
      !state.bam.block([viewer, item.postAuthorDid]) &&
      (item.type === 'post' || !state.bam.mute([viewer, item.postAuthorDid]))
    )
  })
  return state
}

const presentation = (state: HydrationState, ctx: Context) => {
  const { feedService } = ctx
  const { feedItems, cursor, params } = state
  const feed = feedService.views.formatFeed(feedItems, state, params.viewer)
  return { feed, cursor }
}

type Context = {
  db: Database
  actorService: ActorService
  feedService: FeedService
  graphService: GraphService
}

type Params = QueryParams & { viewer: string | null }

type SkeletonState = {
  params: Params
  feedItems: FeedRow[]
  cursor?: string
}

type HydrationState = SkeletonState & FeedHydrationState
