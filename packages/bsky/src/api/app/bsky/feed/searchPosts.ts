import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import AtpAgent from '@atproto/api'
import { AtUri } from '@atproto/syntax'
import { mapDefined } from '@atproto/common'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/searchPosts'
import { Database } from '../../../../db'
import { FeedHydrationState, FeedService } from '../../../../services/feed'
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
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth, params }) => {
      const viewer = auth.credentials.did
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
  return {
    params,
    postUris: res.data.posts.map((a) => a.uri),
    cursor: res.data.cursor,
  }
}

const hydration = async (
  state: SkeletonState,
  ctx: Context,
): Promise<HydrationState> => {
  const { feedService } = ctx
  const { params, postUris } = state
  const uris = new Set<string>(postUris)
  const dids = new Set<string>(postUris.map((uri) => new AtUri(uri).hostname))
  const hydrated = await feedService.feedHydration({
    uris,
    dids,
    viewer: params.viewer,
  })
  return { ...state, ...hydrated }
}

const noBlocks = (state: HydrationState): HydrationState => {
  const { viewer } = state.params
  state.postUris = state.postUris.filter((uri) => {
    const post = state.posts[uri]
    if (!viewer || !post) return true
    return !state.bam.block([viewer, post.creator])
  })
  return state
}

const presentation = (state: HydrationState, ctx: Context) => {
  const { feedService, actorService } = ctx
  const { postUris, profiles, params } = state
  const actors = actorService.views.profileBasicPresentation(
    Object.keys(profiles),
    state,
    { viewer: params.viewer },
  )

  const postViews = mapDefined(postUris, (uri) =>
    feedService.views.formatPostView(
      uri,
      actors,
      state.posts,
      state.threadgates,
      state.embeds,
      state.labels,
      state.lists,
    ),
  )
  return { posts: postViews }
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
  postUris: string[]
  cursor?: string
}

type HydrationState = SkeletonState & FeedHydrationState
