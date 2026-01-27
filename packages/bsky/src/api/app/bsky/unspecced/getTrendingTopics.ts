import { noUndefinedVals } from '@atproto/common'
import { Client } from '@atproto/lex'
import { InternalServerError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
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

const skeleton = async (input: SkeletonFnInput<Context, Params>) => {
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

const hydration = async (
  _: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  return {}
}

const noBlocksOrMutes = (
  input: RulesFnInput<Context, Params, SkeletonState>,
) => {
  const { skeleton } = input
  return skeleton
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { skeleton } = input
  return skeleton
}

type Context = {
  hydrator: Hydrator
  views: Views
  topicsClient: Client | undefined
}

type Params = Omit<app.bsky.unspecced.getTrendingTopics.Params, 'viewer'> & {
  hydrateCtx: HydrateCtx
  headers: Record<string, string>
}

type SkeletonState = {
  topics: app.bsky.unspecced.defs.TrendingTopic[]
  suggested: app.bsky.unspecced.defs.TrendingTopic[]
}
