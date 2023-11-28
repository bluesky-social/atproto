import { dedupeStrs } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getPosts'
import AppContext from '../../../../context'
import { Database } from '../../../../db'
import {
  FeedHydrationState,
  FeedRow,
  FeedService,
} from '../../../../services/feed'
import { createPipeline } from '../../../../pipeline'
import { ActorService } from '../../../../services/actor'

export default function (server: Server, ctx: AppContext) {
  const getPosts = createPipeline(skeleton, hydration, noBlocks, presentation)
  server.app.bsky.feed.getPosts({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const db = ctx.db.getReplica()
      const feedService = ctx.services.feed(db)
      const actorService = ctx.services.actor(db)
      const viewer = auth.credentials.did

      const results = await getPosts(
        { ...params, viewer },
        { db, feedService, actorService },
      )

      return {
        encoding: 'application/json',
        body: results,
      }
    },
  })
}

const skeleton = async (params: Params, ctx: Context) => {
  const deduped = dedupeStrs(params.uris)
  const feedItems = await ctx.feedService.postUrisToFeedItems(deduped)
  return { params, feedItems }
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

const noBlocks = (state: HydrationState) => {
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
  const SKIP = []
  const actors = actorService.views.profileBasicPresentation(
    Object.keys(profiles),
    state,
    params.viewer,
  )
  const postViews = feedItems.flatMap((item) => {
    const postView = feedService.views.formatPostView(
      item.postUri,
      actors,
      state.posts,
      state.threadgates,
      state.embeds,
      state.labels,
      state.lists,
      params.viewer,
    )
    return postView ?? SKIP
  })
  return { posts: postViews }
}

type Context = {
  db: Database
  feedService: FeedService
  actorService: ActorService
}

type Params = QueryParams & { viewer: string | null }

type SkeletonState = {
  params: Params
  feedItems: FeedRow[]
}

type HydrationState = SkeletonState & FeedHydrationState
