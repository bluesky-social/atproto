import { AtpAgent } from '@atproto/api'
import { mapDefined, noUndefinedVals } from '@atproto/common'
import { HeadersMap } from '@atproto/xrpc'
import { InternalServerError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getSuggestedFollowsByActor'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getSuggestedFollowsByActor = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.app.bsky.graph.getSuggestedFollowsByActor({
    auth: ctx.authVerifier.standard,
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
        'x-bsky-topics': Array.isArray(req.headers['x-bsky-topics'])
          ? req.headers['x-bsky-topics'].join(',')
          : req.headers['x-bsky-topics'],
      })

      let output: OutputSchema
      let responseHeaders = {}

      if (!ctx.suggestionsAgent) {
        output = { suggestions: [] }
      } else {
        const { skeletonHeaders, ...result } = await getSuggestedFollowsByActor(
          { ...params, hydrateCtx: hydrateCtx.copy({ viewer }), headers },
          ctx,
        )
        output = result
        responseHeaders = noUndefinedVals({
          'content-language': skeletonHeaders?.['content-language'],
        })
      }

      return {
        encoding: 'application/json',
        body: output,
        headers: {
          ...responseHeaders,
          ...resHeaders({ labelers: hydrateCtx.labelers }),
        },
      }
    },
  })
}

const skeleton = async (input: SkeletonFnInput<Context, Params>) => {
  const { params, ctx } = input

  // handled above already, this branch should not be reached
  if (!ctx.suggestionsAgent) {
    throw new InternalServerError('Suggestions service not configured')
  }

  const [relativeToDid] = await ctx.hydrator.actor.getDids([params.actor])
  if (!relativeToDid) {
    throw new InvalidRequestError('Actor not found')
  }

  const res =
    await ctx.suggestionsAgent.app.bsky.unspecced.getSuggestionsSkeleton(
      {
        viewer: params.hydrateCtx.viewer ?? undefined,
        relativeToDid,
      },
      { headers: params.headers },
    )
  return {
    recIdStr: res.data.recIdStr,
    suggestedDids: res.data.actors.map((a) => a.did),
    skeletonHeaders: res.headers,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { suggestedDids } = skeleton
  if (
    params.hydrateCtx.features.checkGate(
      params.hydrateCtx.features.Gate.SuggestedUsersSocialProofEnable,
    )
  ) {
    return ctx.hydrator.hydrateProfilesDetailed(
      suggestedDids,
      params.hydrateCtx,
    )
  } else {
    return ctx.hydrator.hydrateProfiles(suggestedDids, params.hydrateCtx)
  }
}

const noBlocksOrMutes = (
  input: RulesFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton, hydration } = input
  skeleton.suggestedDids = skeleton.suggestedDids.filter(
    (did) =>
      !ctx.views.viewerBlockExists(did, hydration) &&
      !ctx.views.viewerMuteExists(did, hydration),
  )
  return skeleton
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, hydration, skeleton } = input
  const { suggestedDids, skeletonHeaders } = skeleton
  const suggestions = mapDefined(suggestedDids, (did) =>
    ctx.views.profileKnownFollowers(did, hydration),
  )
  return {
    recIdStr: skeleton.recIdStr,
    suggestions,
    skeletonHeaders,
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
  suggestionsAgent: AtpAgent | undefined
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx & { viewer: string }
  headers: HeadersMap
}

type SkeletonState = {
  suggestedDids: string[]
  recIdStr?: string
  skeletonHeaders?: HeadersMap
}
