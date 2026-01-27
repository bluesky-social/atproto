import { dedupeStrs, mapDefined, noUndefinedVals } from '@atproto/common'
import { Client, DidString } from '@atproto/lex'
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
  const getTrends = createPipeline(skeleton, hydration, noBlocks, presentation)
  server.add(app.bsky.unspecced.getTrends, {
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
      const result = await getTrends(
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

const skeleton = async (input: SkeletonFnInput<Context, Params>) => {
  const { params, ctx } = input
  if (ctx.topicsClient) {
    return ctx.topicsClient.call(
      app.bsky.unspecced.getTrendsSkeleton,
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
  for (const trend of skeleton.trends) {
    dids.push(...trend.dids)
  }
  dids = dedupeStrs(dids)
  const pairs: Map<DidString, DidString[]> = new Map()
  const viewer = params.hydrateCtx.viewer
  if (viewer) {
    pairs.set(viewer, dids)
  }
  const [profileState, bidirectionalBlocks] = await Promise.all([
    ctx.hydrator.hydrateProfilesBasic(dids, params.hydrateCtx),
    ctx.hydrator.hydrateBidirectionalBlocks(pairs, params.hydrateCtx),
  ])

  return mergeManyStates(profileState, { bidirectionalBlocks })
}

const noBlocks = (input: RulesFnInput<Context, Params, SkeletonState>) => {
  const { skeleton, params, hydration } = input
  const viewer = params.hydrateCtx.viewer
  if (!viewer) {
    return skeleton
  }

  const blocks = hydration.bidirectionalBlocks?.get(viewer)
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
  topicsClient: Client | undefined
}

type Params = app.bsky.unspecced.getTrendingTopics.Params & {
  hydrateCtx: HydrateCtx & { viewer: string | null }
  headers: Record<string, string>
}

type SkeletonState = {
  trends: app.bsky.unspecced.defs.SkeletonTrend[]
}
