import { mapDefined, noUndefinedVals } from '@atproto/common'
import type { AtUriString, Client } from '@atproto/lex'
import { MethodNotImplementedError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import type { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { app } from '../../../../lexicons/index.js'
import {
  type HydrationFnInput,
  type PresentationFnInput,
  type SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline.js'
import { getAtprotoPassthroughHeaders } from '../../../../util/headers.js'
import type { Views } from '../../../../views/index.js'

export default function (server: Server, ctx: AppContext) {
  const getFeeds = createPipeline(skeleton, hydration, noRules, presentation)
  server.add(app.bsky.unspecced.getSuggestedFeeds, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req, signal }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        features: ctx.featureGatesClient.scope(
          ctx.featureGatesClient.parseUserContextFromHandler({ viewer, req }),
        ),
      })
      const headers = noUndefinedVals({
        'accept-language': req.headers['accept-language'],
        ...getAtprotoPassthroughHeaders(req),
      })
      const result = await getFeeds(
        {
          ...params,
          hydrateCtx,
          headers,
          signal,
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

  const useIris = params.hydrateCtx.features.checkGate(
    params.hydrateCtx.features.Gate.SuggestedFeedsV2Enable,
  )
  const client = useIris ? ctx.irisClient : ctx.topicsClient

  if (!client) {
    // Use 501 instead of 500 as these are not considered retry-able by clients
    const agent = useIris ? 'Iris' : 'Topics'
    throw new MethodNotImplementedError(`${agent} agent not available`)
  }

  return client.call(
    app.bsky.unspecced.getSuggestedFeedsSkeleton,
    {
      limit: params.limit,
      viewer: params.hydrateCtx.viewer ?? undefined,
    },
    {
      headers: params.headers,
      signal: params.signal,
    },
  )
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
    recIdStr: skeleton.recIdStr,
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
  topicsClient: Client | undefined
  irisClient: Client | undefined
}

type Params = app.bsky.unspecced.getSuggestedFeeds.$Params & {
  hydrateCtx: HydrateCtx
  headers: Record<string, string>
  signal: AbortSignal
}

type SkeletonState = {
  feeds: AtUriString[]
  recIdStr?: string
}
