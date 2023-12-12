import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getFeedGenerators'
import AppContext from '../../../../context'
import { createPipelineNew, noRulesNew } from '../../../../pipeline'
import { HydrationState, Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'

export default function (server: Server, ctx: AppContext) {
  const getFeedGenerators = createPipelineNew(
    skeleton,
    hydration,
    noRulesNew,
    presentation,
  )
  server.app.bsky.feed.getFeedGenerators({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const viewer = auth.credentials.did
      const view = await getFeedGenerators({ ...params, viewer }, ctx)
      return {
        encoding: 'application/json',
        body: view,
      }
    },
  })
}

const skeleton = async (inputs: { params: Params }): Promise<Skeleton> => {
  return {
    feedUris: inputs.params.feeds,
  }
}

const hydration = async (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}) => {
  const { ctx, params, skeleton } = inputs
  return await ctx.hydrator.hydrateFeedGens(skeleton.feedUris, params.viewer)
}

const presentation = (inputs: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = inputs
  const feeds = mapDefined(skeleton.feedUris, (uri) =>
    ctx.views.feedGenerator(uri, hydration),
  )
  return {
    feeds,
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & { viewer: string | null }

type Skeleton = {
  feedUris: string[]
}

// const skeleton = async (params: Params, ctx: Context) => {
//   const { feedService } = ctx
//   const genInfos = await feedService.getFeedGeneratorInfos(
//     params.feeds,
//     params.viewer,
//   )
//   return {
//     params,
//     generators: Object.values(genInfos),
//   }
// }

// const hydration = async (state: SkeletonState, ctx: Context) => {
//   const { actorService } = ctx
//   const profiles = await actorService.views.profilesBasic(
//     state.generators.map((gen) => gen.creator),
//     state.params.viewer,
//   )
//   return {
//     ...state,
//     profiles,
//   }
// }

// const presentation = (state: HydrationState, ctx: Context) => {
//   const { feedService } = ctx
//   const feeds = mapDefined(state.generators, (gen) =>
//     feedService.views.formatFeedGeneratorView(gen, state.profiles),
//   )
//   return { feeds }
// }

// type Context = {
//   db: Database
//   feedService: FeedService
//   actorService: ActorService
// }

// type Params = { viewer: string | null; feeds: string[] }

// type SkeletonState = { params: Params; generators: FeedGenInfo[] }

// type HydrationState = SkeletonState & { profiles: ActorInfoMap }
