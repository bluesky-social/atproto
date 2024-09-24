import AtpAgent from '@atproto/api'
import { mapDefined, noUndefinedVals } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context.js'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { Server } from '../../../../lexicon/index.js'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getSuggestedFollowsByActor.js'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
} from '../../../../pipeline.js'
import { Views } from '../../../../views/index.js'
import { resHeaders } from '../../../util.js'
import { FeatureGates } from '../../../../feature-gates.js'

export default function (server: Server, ctx: AppContext) {
  const getSuggestedFollowsByActor = ctx.createPipeline(
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
        await getSuggestedFollowsByActor(hydrateCtx, params, headers)
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

const skeleton = async ({
  params,
  ctx,
  headers,
}: SkeletonFnInput<Context, Params>) => {
  const [relativeToDid] = await ctx.hydrator.actor.getDids([params.actor])
  if (!relativeToDid) {
    throw new InvalidRequestError('Actor not found')
  }

  if (ctx.suggestionsAgent) {
    const res =
      await ctx.suggestionsAgent.api.app.bsky.unspecced.getSuggestionsSkeleton(
        {
          viewer: ctx.hydrateCtx.viewer ?? undefined,
          relativeToDid,
        },
        { headers },
      )
    return {
      isFallback: !res.data.relativeToDid,
      suggestedDids: res.data.actors.map((a) => a.did),
      headers: res.headers,
    }
  } else {
    const { dids } = await ctx.hydrator.dataplane.getFollowSuggestions({
      actorDid: ctx.hydrateCtx.viewer,
      relativeToDid,
    })
    return {
      isFallback: true,
      suggestedDids: dids,
    }
  }
}

const hydration = async ({
  ctx,
  skeleton,
}: HydrationFnInput<Context, Params, SkeletonState>) => {
  const { suggestedDids } = skeleton
  return ctx.hydrator.hydrateProfilesDetailed(suggestedDids, ctx.hydrateCtx)
}

const noBlocksOrMutes = ({
  ctx,
  skeleton,
  hydration,
}: RulesFnInput<Context, Params, SkeletonState>) => {
  skeleton.suggestedDids = skeleton.suggestedDids.filter(
    (did) =>
      !ctx.views.viewerBlockExists(did, hydration) &&
      !ctx.views.viewerMuteExists(did, hydration),
  )
  return skeleton
}

const presentation = ({
  ctx,
  hydration,
  skeleton,
}: PresentationFnInput<Context, Params, SkeletonState>) => {
  const { suggestedDids, headers } = skeleton
  const suggestions = mapDefined(suggestedDids, (did) =>
    ctx.views.profileDetailed(did, hydration),
  )
  return { isFallback: skeleton.isFallback, suggestions, headers }
}

type Context = {
  hydrator: Hydrator
  views: Views
  suggestionsAgent?: AtpAgent
  featureGates: FeatureGates
  hydrateCtx: HydrateCtx & { viewer: string }
}

type Params = QueryParams

type SkeletonState = {
  isFallback: boolean
  suggestedDids: string[]
  headers?: Record<string, string>
}
