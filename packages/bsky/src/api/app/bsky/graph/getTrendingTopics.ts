import { noUndefinedVals } from '@atproto/common'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import getSuggestedFollowsByActor from './getSuggestedFollowsByActor'
import {
  createPipeline,
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
} from '../../../../pipeline'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { QueryParams } from '../../../../lexicon/types/app/bsky/unspecced/getTrendingTopics'
import AtpAgent from '@atproto/api'


export default function (server: Server, ctx: AppContext) {
  const getTrendingTopics = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.app.bsky.unspecced.getTrendingTopics({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const headers = noUndefinedVals({
        'accept-language': req.headers['accept-language'],
      })
      const { headers: resultHeaders, ...result } = await getTrendingTopics(
        { ...params, hydrateCtx: hydrateCtx.copy({ viewer }), headers },
        ctx,
      )
      const responseHeaders = noUndefinedVals({
        'content-language': resultHeaders?.['content-language'],
      })
      return {
        encoding: 'application/json',
        body: result,
        headers: {
          ...responseHeaders,
        },
      }
    },
  })
}

const skeleton = async (input: SkeletonFnInput<Context, Params>) => {
  const { params, ctx } = input

  if (ctx.topicsAgent) {
    const res = await ctx.topicsAgent.app.bsky.unspecced.getTrendingTopics({
      viewer: params.hydrateCtx.viewer ?? undefined,
    }),
    { headers: params.headers },
  }
}

const hydration = async (
  _: HydrationFnInput<Context, Params, SkeletonState>,
) => {}

const noBlocksOrMutes = (_: RulesFnInput<Context, Params, SkeletonState>) => {
  return skeleton
}

const presentation = (
  _: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  return skeleton
}

type Context = {
  hydrator: Hydrator
  views: Views
  topicsAgent: AtpAgent | undefined
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx & { viewer: string }
  headers: Record<string, string>
}

type SkeletonState = {
  response: any
}
