import { noUndefinedVals } from '@atproto/common'
import type { Client } from '@atproto/lex'
import { MethodNotImplementedError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import type { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { app } from '../../../../lexicons/index.js'
import {
  type HydrationFn,
  type PresentationFn,
  type RulesFn,
  type SkeletonFn,
  createPipeline,
} from '../../../../pipeline.js'
import type { Views } from '../../../../views/index.js'

export default function (server: Server, ctx: AppContext) {
  const getTrendingTopics = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.add(app.bsky.unspecced.getTrendingTopics, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        features: ctx.featureGatesClient.scope(
          ctx.featureGatesClient.parseUserContextFromHandler({
            viewer,
            req,
          }),
        ),
      })
      const headers = noUndefinedVals({
        'accept-language': req.headers['accept-language'],
      })
      const result = await getTrendingTopics(
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

const skeleton: SkeletonFn<Context, Params, SkeletonState> = async (input) => {
  const { params, ctx } = input

  // Route treatment users to iris (trending-topics v2), everyone else stays on
  // the existing hot-topic service.
  const useIris = params.hydrateCtx.features.checkGate(
    params.hydrateCtx.features.Gate.TrendingTopicsV2,
  )
  const topicsClient = (useIris && ctx.irisClient) || ctx.topicsClient

  if (!topicsClient) {
    // Use 501 instead of 500 as these are not considered retry-able by clients
    throw new MethodNotImplementedError('Topics agent not available')
  }

  return topicsClient.call(
    app.bsky.unspecced.getTrendingTopics,
    {
      limit: params.limit,
      viewer: params.hydrateCtx.viewer ?? undefined,
    },
    {
      headers: params.headers,
    },
  )
}

const hydration: HydrationFn<Context, Params, SkeletonState> = async () => {
  return {}
}

const noBlocksOrMutes: RulesFn<Context, Params, SkeletonState> = (input) => {
  return input.skeleton
}

const presentation: PresentationFn<
  Context,
  Params,
  SkeletonState,
  SkeletonState
> = (input) => {
  return input.skeleton
}

type Context = {
  hydrator: Hydrator
  views: Views
  topicsClient: Client | undefined
  irisClient: Client | undefined
}

type Params = Omit<app.bsky.unspecced.getTrendingTopics.$Params, 'viewer'> & {
  hydrateCtx: HydrateCtx
  headers: Record<string, string>
}

type SkeletonState = app.bsky.unspecced.getTrendingTopics.$OutputBody
