import { mapDefined, noUndefinedVals } from '@atproto/common'
import { AtUriString, Client } from '@atproto/lex'
import { MethodNotImplementedError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { app } from '../../../../lexicons/index.js'
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
  server.add(app.bsky.unspecced.getSuggestedFeeds, {
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
      const result = await getFeeds(
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
      app.bsky.unspecced.getSuggestedFeedsSkeleton,
      {
        limit: params.limit,
        viewer: params.hydrateCtx.viewer ?? undefined,
      },
      {
        headers: params.headers,
      },
    )
  } else {
    // Use 501 instead of 500 as these are not considered retry-able by clients
    throw new MethodNotImplementedError('Topics agent not available')
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
  topicsClient: Client | undefined
}

type Params = app.bsky.unspecced.getSuggestedFeeds.Params & {
  hydrateCtx: HydrateCtx
  headers: Record<string, string>
}

type SkeletonState = {
  feeds: AtUriString[]
}
