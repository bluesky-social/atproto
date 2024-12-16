import { noUndefinedVals } from '@atproto/common'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  createPipeline,
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
} from '../../../../pipeline'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { QueryParams } from '../../../../lexicon/types/app/bsky/unspecced/getTrendingTopics'
import AtpAgent from '@atproto/api'
import { TrendingTopic } from '../../../../lexicon/types/app/bsky/unspecced/defs'
import { InternalServerError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  const getTrendingTopics = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.app.bsky.unspecced.getTrendingTopics({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const headers = noUndefinedVals({
        'accept-language': req.headers['accept-language'],
      })
      const { ...result } = await getTrendingTopics(
        { ...params, hydrateCtx: hydrateCtx.copy({ viewer }), headers },
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
    const res = await ctx.topicsAgent.app.bsky.unspecced.getTrendingTopics(
      {
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
  topicsAgent: AtpAgent | undefined
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx & { viewer: string | null }
  headers: Record<string, string>
}

type SkeletonState = {
  topics: TrendingTopic[]
  suggested: TrendingTopic[]
}
