import AtpAgent from '@atproto/api'
import { dedupeStrs, mapDefined, noUndefinedVals } from '@atproto/common'
import { InternalServerError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { FeatureGates } from '../../../../feature-gates'
import {
  HydrateCtx,
  Hydrator,
  mergeManyStates,
} from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/unspecced/getSuggestedUsers'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline'
import { Views } from '../../../../views'

export default function (server: Server, ctx: AppContext) {
  const getSuggestedUsers = createPipeline(
    skeleton,
    hydration,
    noBlocksOrFollows,
    presentation,
  )
  server.app.bsky.unspecced.getSuggestedUsers({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const headers = noUndefinedVals({
        'accept-language': req.headers['accept-language'],
        'x-bsky-topics': Array.isArray(req.headers['x-bsky-topics'])
          ? req.headers['x-bsky-topics'].join(',')
          : req.headers['x-bsky-topics'],
      })
      const result = await getSuggestedUsers(
        {
          ...params,
          hydrateCtx,
          headers,
        },
        ctx,
      )
      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

// TODO: rename to `skeleton` once we can fully migrate to Discover
const skeletonFromDiscover = async (
  input: SkeletonFnInput<Context, Params>,
) => {
  const { params, ctx } = input
  if (!ctx.suggestionsAgent)
    throw new InternalServerError('Suggestions agent not available')

  const res =
    await ctx.suggestionsAgent.app.bsky.unspecced.getSuggestedUsersSkeleton(
      {
        limit: params.limit,
        viewer: params.hydrateCtx.viewer ?? undefined,
        category: params.category,
      },
      {
        headers: params.headers,
      },
    )

  return res.data
}

const skeletonFromTopics = async (input: SkeletonFnInput<Context, Params>) => {
  const { params, ctx } = input
  if (!ctx.topicsAgent)
    throw new InternalServerError('Topics agent not available')

  const res =
    await ctx.topicsAgent.app.bsky.unspecced.getSuggestedUsersSkeleton(
      {
        limit: params.limit,
        viewer: params.hydrateCtx.viewer ?? undefined,
        category: params.category,
      },
      {
        headers: params.headers,
      },
    )

  return res.data
}

const skeleton = async (input: SkeletonFnInput<Context, Params>) => {
  const useDiscover = input.ctx.featureGates.check(
    input.ctx.featureGates.ids.SuggestedUsersDiscoverAgentEnable,
    input.ctx.featureGates.userContext({ did: input.params.hydrateCtx.viewer }),
  )
  const skeletonFn = useDiscover ? skeletonFromDiscover : skeletonFromTopics
  return skeletonFn(input)
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const dids = dedupeStrs(skeleton.dids)
  const pairs: Map<string, string[]> = new Map()
  const viewer = params.hydrateCtx.viewer
  if (viewer) {
    pairs.set(viewer, dids)
  }
  const [profilesState, bidirectionalBlocks] = await Promise.all([
    ctx.hydrator.hydrateProfiles(dids, params.hydrateCtx),
    ctx.hydrator.hydrateBidirectionalBlocks(pairs, params.hydrateCtx),
  ])

  return mergeManyStates(profilesState, { bidirectionalBlocks })
}

const noBlocksOrFollows = (
  input: RulesFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton, params, hydration } = input
  const viewer = params.hydrateCtx.viewer
  if (!viewer) {
    return skeleton
  }
  const blocks = hydration.bidirectionalBlocks?.get(viewer)
  return {
    ...skeleton,
    dids: skeleton.dids.filter((did) => {
      const viewer = ctx.views.profileViewer(did, hydration)
      return !blocks?.get(did) && !viewer?.following
    }),
  }
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton, hydration } = input
  return {
    recId: skeleton.recId,
    actors: mapDefined(skeleton.dids, (did) =>
      ctx.views.profile(did, hydration),
    ),
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
  topicsAgent: AtpAgent | undefined
  suggestionsAgent: AtpAgent | undefined
  featureGates: FeatureGates
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx & { viewer: string | null }
  headers: Record<string, string>
  category?: string
}

type SkeletonState = {
  dids: string[]
  recId?: string
}
