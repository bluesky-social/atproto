import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getActorLikes'
import { FeedKeyset } from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { setRepoRev } from '../../../util'
import {
  FeedHydrationState,
  FeedRow,
  FeedService,
} from '../../../../services/feed'
import { Database } from '../../../../db'
import { ActorService } from '../../../../services/actor'
import { GraphService } from '../../../../services/graph'
import { createPipeline } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getActorLikes = createPipeline(
    skeleton,
    hydration,
    noPostBlocks,
    presentation,
  )
  server.app.bsky.feed.getActorLikes({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, res }) => {
      const viewer = auth.credentials.iss
      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const feedService = ctx.services.feed(db)
      const graphService = ctx.services.graph(db)

      const [result, repoRev] = await Promise.all([
        getActorLikes(
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

const skeleton = async (
  params: Params,
  ctx: Context,
): Promise<SkeletonState> => {
  const { db, actorService, feedService } = ctx
  const { actor, limit, cursor, viewer } = params
  const { ref } = db.db.dynamic

  const actorRes = await actorService.getActor(actor)
  if (!actorRes) {
    throw new InvalidRequestError('Profile not found')
  }
  const actorDid = actorRes.did

  if (!viewer || viewer !== actorDid) {
    throw new InvalidRequestError('Profile not found')
  }

  if (FeedKeyset.clearlyBad(cursor)) {
    return { params, feedItems: [] }
  }

  let feedItemsQb = feedService
    .selectFeedItemQb()
    .innerJoin('like', 'like.subject', 'feed_item.uri')
    .where('like.creator', '=', actorDid)

  const keyset = new FeedKeyset(ref('like.sortAt'), ref('like.cid'))

  feedItemsQb = paginate(feedItemsQb, {
    limit,
    cursor,
    keyset,
  })

  const feedItems = await feedItemsQb.execute()

  return { params, feedItems, cursor: keyset.packFromResult(feedItems) }
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

const noPostBlocks = (state: HydrationState) => {
  const { viewer } = state.params
  state.feedItems = state.feedItems.filter(
    (item) => !viewer || !state.bam.block([viewer, item.postAuthorDid]),
  )
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
  feedService: FeedService
  actorService: ActorService
  graphService: GraphService
}

type Params = QueryParams & { viewer: string | null }

type SkeletonState = { params: Params; feedItems: FeedRow[]; cursor?: string }

type HydrationState = SkeletonState & FeedHydrationState
