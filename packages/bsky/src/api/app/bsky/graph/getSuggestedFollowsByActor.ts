import { mapDefined, noUndefinedVals } from '@atproto/common'
import { Client, DidString } from '@atproto/lex'
import {
  Headers as HeadersMap,
  InternalServerError,
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

      if (!ctx.suggestionsClient) {
        return {
          encoding: 'application/json',
          body: { suggestions: [] },
          headers: resHeaders({ labelers: hydrateCtx.labelers }),
        }
      }

      const headers = noUndefinedVals({
        'accept-language': req.headers['accept-language'],
        'x-bsky-topics': Array.isArray(req.headers['x-bsky-topics'])
          ? req.headers['x-bsky-topics'].join(',')
          : req.headers['x-bsky-topics'],
      })

      const { contentLanguage, ...body } = await getSuggestedFollowsByActor(
        { ...params, hydrateCtx, headers },
        ctx,
      )

      return {
        encoding: 'application/json',
        body,
        headers: {
          ...(contentLanguage ? { 'content-language': contentLanguage } : null),
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

  // handled above already, this branch should not be reached
  if (!ctx.suggestionsClient) {
    throw new InternalServerError('Suggestions service not configured')
  }

  const [relativeToDid] = await ctx.hydrator.actor.getDids([params.actor])
  if (!relativeToDid) {
    throw new InvalidRequestError('Actor not found')
  }

  const res = await ctx.suggestionsClient.xrpc(
    app.bsky.unspecced.getSuggestionsSkeleton,
    {
      strictResponseProcessing: false,
      validateResponse: false,
      params: {
        viewer: params.hydrateCtx.viewer ?? undefined,
        relativeToDid,
      },
      headers: params.headers,
    },
  )

  return {
    recIdStr: res.body.recIdStr,
    suggestedDids: res.body.actors.map((a) => a.did),
    contentLanguage: res.headers.get('content-language') ?? undefined,
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
  const { suggestedDids, contentLanguage } = skeleton
  const suggestions = mapDefined(suggestedDids, (did) =>
    ctx.views.profileKnownFollowers(did, hydration),
  )
  return {
    recIdStr: skeleton.recIdStr,
    contentLanguage,
    suggestions,
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
  suggestionsClient: Client | undefined
}

type Params = app.bsky.graph.getSuggestedFollowsByActor.$Params & {
  hydrateCtx: HydrateCtx & { viewer: string }
  headers: HeadersMap
}

type SkeletonState = {
  suggestedDids: DidString[]
  recIdStr?: string
  contentLanguage?: string
}
