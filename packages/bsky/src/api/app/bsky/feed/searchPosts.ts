import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import AtpAgent from '@atproto/api'
import { mapDefined } from '@atproto/common'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/searchPosts'
import { Database } from '../../../../db'
import {
  FeedHydrationState,
  FeedRow,
  FeedService,
} from '../../../../services/feed'
import { ActorService } from '../../../../services/actor'
import { createPipeline } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const searchPosts = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.feed.searchPosts({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params }) => {
      const viewer = auth.credentials.iss
      const db = ctx.db.getReplica('search')
      const feedService = ctx.services.feed(db)
      const actorService = ctx.services.actor(db)
      const searchAgent = ctx.searchAgent
      if (!searchAgent) {
        throw new InvalidRequestError('Search not available')
      }

      const results = await searchPosts(
        { ...params, viewer },
        { db, feedService, actorService, searchAgent },
      )

      return {
        encoding: 'application/json',
        body: results,
      }
    },
  })
}

const skeleton = async (
  params: Params,
  ctx: Context,
): Promise<SkeletonState> => {
  const res = await ctx.searchAgent.api.app.bsky.unspecced.searchPostsSkeleton({
    q: params.q,
    cursor: params.cursor,
    limit: params.limit,
  })
  const postUris = res.data.posts.map((a) => a.uri)
  const feedItems = await ctx.feedService.postUrisToFeedItems(postUris)
  return {
    params,
    feedItems,
    cursor: res.data.cursor,
    hitsTotal: res.data.hitsTotal,
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

const noBlocks = (state: HydrationState): HydrationState => {
  const { viewer } = state.params
  state.feedItems = state.feedItems.filter((item) => {
    if (!viewer) return true
    return !state.bam.block([viewer, item.postAuthorDid])
  })
  return state
}

const presentation = (state: HydrationState, ctx: Context) => {
  const { feedService, actorService } = ctx
  const { feedItems, profiles, params } = state
  const actors = actorService.views.profileBasicPresentation(
    Object.keys(profiles),
    state,
    params.viewer,
  )

  const postViews = mapDefined(feedItems, (item) =>
    feedService.views.formatPostView(
      item.postUri,
      actors,
      state.posts,
      state.threadgates,
      state.embeds,
      state.labels,
      state.lists,
      params.viewer,
    ),
  )
  return { posts: postViews, cursor: state.cursor, hitsTotal: state.hitsTotal }
}

type Context = {
  db: Database
  feedService: FeedService
  actorService: ActorService
  searchAgent: AtpAgent
}

type Params = QueryParams & { viewer: string | null }

type SkeletonState = {
  params: Params
  feedItems: FeedRow[]
  hitsTotal?: number
  cursor?: string
}

type HydrationState = SkeletonState & FeedHydrationState
