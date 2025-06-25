import AtpAgent from '@atproto/api'
import { mapDefined, noUndefinedVals } from '@atproto/common'
import { InternalServerError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/unspecced/getTrendingTopics'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline'
import { Views } from '../../../../views'

export default function (server: Server, ctx: AppContext) {
  const getFeeds = createPipeline(skeleton, hydration, noRules, presentation)
  server.app.bsky.unspecced.getSuggestedFeeds({
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
      const { ...result } = await getFeeds(
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
      await ctx.topicsAgent.app.bsky.unspecced.getSuggestedFeedsSkeleton(
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
  return await ctx.hydrator.hydrateFeedGens(skeleton.feeds, params.hydrateCtx)
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton, hydration } = input

  return {
    feeds: mapDefined(skeleton.feeds, (uri) =>
      ctx.views.feedGenerator(uri, hydration),
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
  feeds: string[]
}
