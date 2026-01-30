import { noUndefinedVals } from '@atproto/common'
import { Client } from '@atproto/lex'
import { InternalServerError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
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
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
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
  if (ctx.topicsClient) {
    return ctx.topicsClient.call(
      app.bsky.unspecced.getTrendingTopics,
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
}

type Params = Omit<app.bsky.unspecced.getTrendingTopics.$Params, 'viewer'> & {
  hydrateCtx: HydrateCtx
  headers: Record<string, string>
}

type SkeletonState = app.bsky.unspecced.getTrendingTopics.$OutputBody
