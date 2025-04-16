import AtpAgent, { AtUri } from '@atproto/api'
import { dedupeStrs, mapDefined, noUndefinedVals } from '@atproto/common'
import { InternalServerError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import {
  HydrateCtx,
  Hydrator,
  mergeManyStates,
} from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/unspecced/getTrendingTopics'
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
  server.app.bsky.unspecced.getSuggestedStarterPacks({
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
      const { ...result } = await getSuggestedStarterPacks(
        {
          ...params,
          viewer: viewer ?? undefined,
          hydrateCtx: hydrateCtx.copy({ viewer }),
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

const skeleton = async (input: SkeletonFnInput<Context, Params>) => {
  const { params, ctx } = input
  if (ctx.topicsAgent) {
    const res =
      await ctx.topicsAgent.app.bsky.unspecced.getSuggestedStarterPacksSkeleton(
        {
          limit: params.limit,
          viewer: params.viewer,
        },
        {
          headers: params.headers,
        },
      )

    return res.data
  } else {
    throw new InternalServerError('Topics agent not available')
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  let dids: string[] = []
  for (const uri of skeleton.starterPacks) {
    let aturi: AtUri | undefined
    try {
      aturi = new AtUri(uri)
    } catch {
      continue
    }
    dids.push(aturi.hostname)
  }
  dids = dedupeStrs(dids)
  const pairs: Map<string, string[]> = new Map()
  if (params.viewer) {
    pairs.set(params.viewer, dids)
  }
  const [starterPacksState, bidirectionalBlocks] = await Promise.all([
    ctx.hydrator.hydrateStarterPacks(skeleton.starterPacks, params.hydrateCtx),
    ctx.hydrator.hydrateBidirectionalBlocks(pairs),
  ])

  return mergeManyStates(starterPacksState, { bidirectionalBlocks })
}

const noBlocks = (input: RulesFnInput<Context, Params, SkeletonState>) => {
  const { skeleton, params, hydration } = input

  if (!params.viewer) {
    return skeleton
  }

  const blocks = hydration.bidirectionalBlocks?.get(params.viewer)
  const filteredSkeleton: SkeletonState = {
    starterPacks: skeleton.starterPacks.filter((uri) => {
      let aturi: AtUri | undefined
      try {
        aturi = new AtUri(uri)
      } catch {
        return false
      }
      return !blocks?.get(aturi.hostname)
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
  topicsAgent: AtpAgent | undefined
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx & { viewer: string | null }
  headers: Record<string, string>
}

type SkeletonState = {
  starterPacks: string[]
}
