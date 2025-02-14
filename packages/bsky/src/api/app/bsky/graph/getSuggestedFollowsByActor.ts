import { mapDefined, noUndefinedVals } from '@atproto/common'
import { HeadersMap } from '@atproto/xrpc'
import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon/index'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getSuggestedFollowsByActor'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'
import { StandardOutput } from '../../../../auth-verifier'

type Skeleton = {
  isFallback: boolean
  suggestedDids: string[]
  headers?: HeadersMap
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getSuggestedFollowsByActor({
    auth: ctx.authVerifier.standard,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlocksOrMutes,
      presentation,
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams, StandardOutput> = async (
  ctx,
) => {
  const [relativeToDid] = await ctx.hydrator.actor.getDids([ctx.params.actor])
  if (!relativeToDid) {
    throw new InvalidRequestError('Actor not found')
  }

  if (ctx.suggestionsAgent) {
    const res =
      await ctx.suggestionsAgent.app.bsky.unspecced.getSuggestionsSkeleton(
        {
          viewer: ctx.viewer,
          relativeToDid,
        },
        {
          headers: noUndefinedVals({
            'accept-language': ctx.headers['accept-language'],
            'x-bsky-topics': Array.isArray(ctx.headers['x-bsky-topics'])
              ? ctx.headers['x-bsky-topics'].join(',')
              : ctx.headers['x-bsky-topics'],
          }),
        },
      )
    return {
      isFallback: !res.data.relativeToDid,
      suggestedDids: res.data.actors.map((a) => a.did),
      headers: res.headers,
    }
  } else {
    const { dids } = await ctx.hydrator.dataplane.getFollowSuggestions({
      actorDid: ctx.viewer,
      relativeToDid,
    })
    return {
      isFallback: true,
      suggestedDids: dids,
    }
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async (ctx, skeleton) => {
  return ctx.hydrator.hydrateProfilesDetailed(skeleton.suggestedDids, ctx)
}

const noBlocksOrMutes: RulesFn<Skeleton, QueryParams> = (
  ctx,
  skeleton,
  hydration,
) => {
  skeleton.suggestedDids = skeleton.suggestedDids.filter(
    (did) =>
      !ctx.views.viewerBlockExists(did, hydration) &&
      !ctx.views.viewerMuteExists(did, hydration),
  )
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = (
  ctx,
  skeleton,
  hydration,
) => {
  const suggestions = mapDefined(skeleton.suggestedDids, (did) =>
    ctx.views.profileDetailed(did, hydration),
  )
  return {
    headers: skeleton.headers,
    body: {
      isFallback: skeleton.isFallback,
      suggestions,
    },
  }
}
