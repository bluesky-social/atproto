import { AtpAgent } from '@atproto/api'
import { mapDefined, noUndefinedVals } from '@atproto/common'
import { HeadersMap } from '@atproto/xrpc'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getSuggestedFollowsByActor'
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
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const headers = noUndefinedVals({
        'accept-language': req.headers['accept-language'],
        'x-bsky-topics': Array.isArray(req.headers['x-bsky-topics'])
          ? req.headers['x-bsky-topics'].join(',')
          : req.headers['x-bsky-topics'],
      })
      const { headers: resultHeaders, ...result } =
        await getSuggestedFollowsByActor(
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
          ...resHeaders({ labelers: hydrateCtx.labelers }),
        },
      }
    },
  })
}

const skeleton = async (input: SkeletonFnInput<Context, Params>) => {
  const { params, ctx } = input
  const [relativeToDid] = await ctx.hydrator.actor.getDids([params.actor])
  if (!relativeToDid) {
    throw new InvalidRequestError('Actor not found')
  }

  if (ctx.suggestionsAgent) {
    const res =
      await ctx.suggestionsAgent.api.app.bsky.unspecced.getSuggestionsSkeleton(
        {
          viewer: params.hydrateCtx.viewer ?? undefined,
          relativeToDid,
        },
        { headers: params.headers },
      )
    return {
      isFallback: !res.data.relativeToDid,
      suggestedDids: res.data.actors.map((a) => a.did),
      recId: res.data.recId,
      headers: res.headers,
    }
  } else {
    const { dids } = await ctx.hydrator.dataplane.getFollowSuggestions({
      actorDid: params.hydrateCtx.viewer,
      relativeToDid,
    })
    return {
      isFallback: true,
      suggestedDids: dids,
    }
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { suggestedDids } = skeleton
  return ctx.hydrator.hydrateProfilesDetailed(suggestedDids, params.hydrateCtx)
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
  const { suggestedDids, headers } = skeleton
  const suggestions = mapDefined(suggestedDids, (did) =>
    ctx.views.profileDetailed(did, hydration),
  )
  return {
    isFallback: skeleton.isFallback,
    suggestions,
    recId: skeleton.recId,
    headers,
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
  suggestionsAgent: AtpAgent | undefined
  featureGates: AppContext['featureGates']
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx & { viewer: string }
  headers: HeadersMap
}

type SkeletonState = {
  isFallback: boolean
  suggestedDids: string[]
  recId?: number
  headers?: HeadersMap
}
