import { dedupeStrs } from '@atproto/common'
import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getPosts'
import AppContext from '../../../../context'
import { Database } from '../../../../db'
import { FeedHydrationState, FeedService } from '../../../../services/feed'
import { createPipeline } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getPosts = createPipeline(skeleton, hydration, noBlocks, presentation)
  server.app.bsky.feed.getPosts({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const db = ctx.db.getReplica()
      const feedService = ctx.services.feed(db)
      const viewer = auth.credentials.did

      const results = await getPosts({ ...params, viewer }, { db, feedService })

      return {
        encoding: 'application/json',
        body: results,
      }
    },
  })
}

const skeleton = async (params: Params) => {
  return { params, postUris: dedupeStrs(params.uris) }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
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

const noBlocks = (state: HydrationState) => {
  const { viewer } = state.params
  state.postUris = state.postUris.filter((uri) => {
    const post = state.posts[uri]
    if (!viewer || !post) return true
    return !state.bam.block([viewer, post.creator])
  })
  return state
}

const presentation = (state: HydrationState, ctx: Context) => {
  const { feedService } = ctx
  const { postUris } = state
  const SKIP = []
  const postViews = postUris.flatMap((uri) => {
    const postView = feedService.views.formatPostView(
      uri,
      state.actors,
      state.posts,
      state.embeds,
      state.labels,
    )
    return postView ?? SKIP
  })
  return { posts: postViews }
}

type Context = {
  db: Database
  feedService: FeedService
}

type Params = QueryParams & { viewer: string | null }

type SkeletonState = {
  params: Params
  postUris: string[]
}

type HydrationState = SkeletonState & FeedHydrationState
