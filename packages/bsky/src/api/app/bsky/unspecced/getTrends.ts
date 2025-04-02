import AtpAgent from '@atproto/api'
import { dedupeStrs, mapDefined, noUndefinedVals } from '@atproto/common'
import { InternalServerError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import {
  HydrateCtx,
  Hydrator,
  mergeManyStates,
} from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { SkeletonTrend } from '../../../../lexicon/types/app/bsky/unspecced/defs'
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
  const getTrends = createPipeline(skeleton, hydration, noBlocks, presentation)
  server.app.bsky.unspecced.getTrends({
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
      const { ...result } = await getTrends(
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
    const res = await ctx.topicsAgent.app.bsky.unspecced.getTrendsSkeleton(
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
  for (const trend of skeleton.trends) {
    dids.push(...trend.dids)
  }
  dids = dedupeStrs(dids)
  const pairs: Map<string, string[]> = new Map()
  if (params.viewer) {
    pairs.set(params.viewer, dids)
  }
  const [profileState, bidirectionalBlocks] = await Promise.all([
    ctx.hydrator.hydrateProfilesBasic(dids, params.hydrateCtx),
    ctx.hydrator.hydrateBidirectionalBlocks(pairs),
  ])

  return mergeManyStates(profileState, { bidirectionalBlocks })
}

const noBlocks = (input: RulesFnInput<Context, Params, SkeletonState>) => {
  const { skeleton, params, hydration } = input

  if (!params.viewer) {
    return skeleton
  }

  const blocks = hydration.bidirectionalBlocks?.get(params.viewer)
  const filteredSkeleton: SkeletonState = {
    trends: skeleton.trends.map((t) => ({
      ...t,
      dids: t.dids.filter((did) => !blocks?.get(did)),
    })),
  }

  return filteredSkeleton
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton, hydration } = input

  return {
    trends: skeleton.trends.map((t) => ({
      topic: t.topic,
      displayName: t.displayName,
      link: t.link,
      startedAt: t.startedAt,
      postCount: t.postCount,
      status: t.status,
      category: t.category,
      actors: mapDefined(t.dids, (did) =>
        ctx.views.profileBasic(did, hydration),
      ),
    })),
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
  trends: SkeletonTrend[]
}
