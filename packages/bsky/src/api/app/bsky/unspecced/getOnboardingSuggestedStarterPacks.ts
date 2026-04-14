import { mapDefined, noUndefinedVals } from '@atproto/common'
import { Client } from '@atproto/lex'
import { AtUri, AtUriString, DidString } from '@atproto/syntax'
import { MethodNotImplementedError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import {
  HydrateCtx,
  Hydrator,
  mergeManyStates,
} from '../../../../hydration/hydrator'
import { app } from '../../../../lexicons/index.js'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
  createPipeline,
} from '../../../../pipeline'
import { Views } from '../../../../views'

export default function (server: Server, ctx: AppContext) {
  const getOnboardingSuggestedStarterPacks = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.add(app.bsky.unspecced.getOnboardingSuggestedStarterPacks, {
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
      const result = await getOnboardingSuggestedStarterPacks(
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

const skeleton: SkeletonFn<Context, Params, SkeletonState> = async (
  input,
): Promise<SkeletonState> => {
  const { params, ctx } = input

  if (!ctx.topicsClient) {
    // Use 501 instead of 500 as these are not considered retry-able by clients
    throw new MethodNotImplementedError('Topics agent not available')
  }

  const skeleton = await ctx.topicsClient.call(
    app.bsky.unspecced.getOnboardingSuggestedStarterPacksSkeleton,
    { limit: params.limit, viewer: params.hydrateCtx.viewer ?? undefined },
    { headers: params.headers },
  )

  // @TODO Make sure upstream always provides this
  skeleton.starterPacks ??= []

  return skeleton
}

const hydration: HydrationFn<Context, Params, SkeletonState> = async (
  input,
) => {
  const { ctx, params, skeleton } = input

  const pairs: Map<DidString, DidString[]> = new Map()
  const viewer = params.hydrateCtx.viewer
  if (viewer) {
    pairs.set(viewer, getUniqueDidsFromStarterPacks(skeleton.starterPacks))
  }
  const [starterPacksState, bidirectionalBlocks] = await Promise.all([
    ctx.hydrator.hydrateStarterPacks(skeleton.starterPacks, params.hydrateCtx),
    ctx.hydrator.hydrateBidirectionalBlocks(pairs, params.hydrateCtx),
  ])

  return mergeManyStates(starterPacksState, { bidirectionalBlocks })
}

const noBlocks: RulesFn<Context, Params, SkeletonState> = (input) => {
  const { skeleton, params, hydration } = input
  const viewer = params.hydrateCtx.viewer
  if (!viewer) {
    return skeleton
  }

  const blocks = hydration.bidirectionalBlocks?.get(viewer)
  const filteredSkeleton: SkeletonState = {
    starterPacks: skeleton.starterPacks.filter((uri) => {
      try {
        return !blocks?.get(new AtUri(uri).did)
      } catch {
        return false
      }
    }),
  }

  return filteredSkeleton
}

const presentation: PresentationFn<
  Context,
  Params,
  SkeletonState,
  app.bsky.unspecced.getOnboardingSuggestedStarterPacks.$OutputBody
> = (input) => {
  const { ctx, skeleton, hydration } = input

  return {
    starterPacks: mapDefined(skeleton.starterPacks, (uri) =>
      ctx.views.starterPack(uri, hydration),
    ),
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
  topicsClient: Client | undefined
}

type Params = app.bsky.unspecced.getOnboardingSuggestedStarterPacks.$Params & {
  hydrateCtx: HydrateCtx
  headers: Record<string, string>
}

type SkeletonState =
  app.bsky.unspecced.getOnboardingSuggestedStarterPacksSkeleton.$OutputBody

function getUniqueDidsFromStarterPacks(
  starterPacks?: AtUriString[],
): DidString[] {
  if (!starterPacks) return []

  const dids = new Set<DidString>()

  for (const uri of starterPacks) {
    try {
      dids.add(new AtUri(uri).did)
    } catch {
      continue
    }
  }

  return Array.from(dids)
}
