import { dedupeStrs, mapDefined, noUndefinedVals } from '@atproto/common'
import { Client, DidString } from '@atproto/lex'
import { MethodNotImplementedError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { FeatureGates } from '../../../../feature-gates'
import {
  HydrateCtx,
  Hydrator,
  mergeManyStates,
} from '../../../../hydration/hydrator'
import { app } from '../../../../lexicons/index.js'
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
  server.add(app.bsky.unspecced.getSuggestedUsers, {
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
): Promise<SkeletonState> => {
  const { params, ctx } = input
  if (!ctx.suggestionsClient) {
    throw new MethodNotImplementedError('Suggestions agent not available')
  }

  return ctx.suggestionsClient.call(
    app.bsky.unspecced.getSuggestedUsersSkeleton,
    {
      limit: params.limit,
      category: params.category,
      viewer: params.hydrateCtx.viewer ?? undefined,
    },
    {
      headers: params.headers,
    },
  )
}

const skeletonFromTopics = async (
  input: SkeletonFnInput<Context, Params>,
): Promise<SkeletonState> => {
  const { params, ctx } = input
  if (!ctx.topicsClient) {
    throw new MethodNotImplementedError('Topics agent not available')
  }

  return ctx.topicsClient.call(
    app.bsky.unspecced.getSuggestedUsersSkeleton,
    {
      limit: params.limit,
      category: params.category,
      viewer: params.hydrateCtx.viewer ?? undefined,
    },
    {
      headers: params.headers,
    },
  )
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
  const pairs: Map<DidString, DidString[]> = new Map()
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
  topicsClient: Client | undefined
  suggestionsClient: Client | undefined
  featureGates: FeatureGates
}

type Params = app.bsky.unspecced.getSuggestedUsers.Params & {
  hydrateCtx: HydrateCtx & { viewer: string | null }
  headers: Record<string, string>
  category?: string
}

type SkeletonState = {
  dids: DidString[]
  recId?: string
}
