import { mapDefined, noUndefinedVals } from '@atproto/common'
import { Client, DidString } from '@atproto/lex'
import {
  Headers as HeadersMap,
  InvalidRequestError,
  Server,
} from '@atproto/xrpc-server'
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
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getSuggestedFollowsByActor = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.add(app.bsky.graph.getSuggestedFollowsByActor, {
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
      const { contentLanguage, ...result } = await getSuggestedFollowsByActor(
        { ...params, hydrateCtx, headers },
        ctx,
      )
      const responseHeaders = contentLanguage
        ? { 'content-language': contentLanguage }
        : undefined
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

const skeleton = async (
  input: SkeletonFnInput<Context, Params>,
): Promise<SkeletonState> => {
  const { params, ctx } = input
  const [relativeToDid] = await ctx.hydrator.actor.getDids([params.actor])
  if (!relativeToDid) {
    throw new InvalidRequestError('Actor not found')
  }

  if (ctx.suggestionsClient) {
    const res = await ctx.suggestionsClient.xrpc(
      app.bsky.unspecced.getSuggestionsSkeleton,
      {
        params: {
          viewer: params.hydrateCtx.viewer ?? undefined,
          relativeToDid,
        },
        headers: params.headers,
      },
    )
    return {
      isFallback: !res.body.relativeToDid,
      suggestedDids: res.body.actors.map((a) => a.did),
      recId: res.body.recId,
      contentLanguage: res.headers.get('content-language') ?? undefined,
    }
  } else {
    const { dids } = await ctx.hydrator.dataplane.getFollowSuggestions({
      actorDid: params.hydrateCtx.viewer,
      relativeToDid,
    })
    return {
      isFallback: true,
      suggestedDids: dids as DidString[],
    }
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { suggestedDids } = skeleton
  return ctx.hydrator.hydrateProfiles(suggestedDids, params.hydrateCtx)
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
  const { suggestedDids, contentLanguage } = skeleton
  const suggestions = mapDefined(suggestedDids, (did) =>
    ctx.views.profile(did, hydration),
  )
  return {
    isFallback: skeleton.isFallback,
    suggestions,
    recId: skeleton.recId,
    contentLanguage,
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
  suggestionsClient: Client | undefined
  featureGates: AppContext['featureGates']
}

type Params = app.bsky.graph.getSuggestedFollowsByActor.Params & {
  hydrateCtx: HydrateCtx & { viewer: string }
  headers: HeadersMap
}

type SkeletonState = {
  isFallback: boolean
  suggestedDids: DidString[]
  recId?: number
  contentLanguage?: string
}
