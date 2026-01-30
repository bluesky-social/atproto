import { dedupeStrs, mapDefined, noUndefinedVals } from '@atproto/common'
import { Client } from '@atproto/lex'
import { AtUri, AtUriString, DidString } from '@atproto/syntax'
import { InternalServerError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
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
  const getSuggestedStarterPacks = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.add(app.bsky.unspecced.getSuggestedStarterPacks, {
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
      const result = await getSuggestedStarterPacks(
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

const skeleton = async (
  input: SkeletonFnInput<Context, Params>,
): Promise<SkeletonState> => {
  const { params, ctx } = input
  if (ctx.topicsClient) {
    return ctx.topicsClient.call(
      app.bsky.unspecced.getSuggestedStarterPacksSkeleton,
      {
        limit: params.limit,
        viewer: params.hydrateCtx.viewer ?? undefined,
      },
      {
        headers: params.headers,
      },
    )
  } else {
    throw new InternalServerError('Topics agent not available')
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  let dids: DidString[] = []
  for (const uri of skeleton.starterPacks) {
    let aturi: AtUri | undefined
    try {
      aturi = new AtUri(uri)
    } catch {
      continue
    }
    dids.push(aturi.did)
  }
  dids = dedupeStrs(dids)
  const pairs: Map<DidString, DidString[]> = new Map()
  const viewer = params.hydrateCtx.viewer
  if (viewer) {
    pairs.set(viewer, dids)
  }
  const [starterPacksState, bidirectionalBlocks] = await Promise.all([
    ctx.hydrator.hydrateStarterPacks(skeleton.starterPacks, params.hydrateCtx),
    ctx.hydrator.hydrateBidirectionalBlocks(pairs, params.hydrateCtx),
  ])

  return mergeManyStates(starterPacksState, { bidirectionalBlocks })
}

const noBlocks = (input: RulesFnInput<Context, Params, SkeletonState>) => {
  const { skeleton, params, hydration } = input
  const viewer = params.hydrateCtx.viewer
  if (!viewer) {
    return skeleton
  }

  const blocks = hydration.bidirectionalBlocks?.get(viewer)
  const filteredSkeleton: SkeletonState = {
    starterPacks: skeleton.starterPacks.filter((uri) => {
      let aturi: AtUri | undefined
      try {
        aturi = new AtUri(uri)
      } catch {
        return false
      }
      return !blocks?.get(aturi.did)
    }),
  }

  return filteredSkeleton
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
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

type Params = app.bsky.unspecced.getTrendingTopics.Params & {
  hydrateCtx: HydrateCtx & { viewer: string | null }
  headers: Record<string, string>
}

type SkeletonState = {
  starterPacks: AtUriString[]
}
