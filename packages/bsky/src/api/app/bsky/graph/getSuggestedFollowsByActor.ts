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

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({
  ctx,
  params,
  headers,
}) => {
  const [relativeToDid] = await ctx.hydrator.actor.getDids([params.actor])
  if (!relativeToDid) {
    throw new InvalidRequestError('Actor not found')
  }

  if (ctx.suggestionsAgent) {
    const res =
      await ctx.suggestionsAgent.app.bsky.unspecced.getSuggestionsSkeleton(
        {
          viewer: ctx.viewer ?? undefined,
          relativeToDid,
        },
        {
          headers: noUndefinedVals({
            'accept-language': headers['accept-language'],
            'x-bsky-topics': Array.isArray(headers['x-bsky-topics'])
              ? headers['x-bsky-topics'].join(',')
              : headers['x-bsky-topics'],
          }),
        },
      )
    return {
      isFallback: !res.data.relativeToDid,
      suggestedDids: res.data.actors.map((a) => a.did),
      headers: res.headers,
    }
  } else {
    const actorDid = ctx.viewer
    if (!actorDid) throw new InvalidRequestError('An actor is required')

    const { dids } = await ctx.hydrator.dataplane.getFollowSuggestions({
      actorDid,
      relativeToDid,
    })
    return {
      isFallback: true,
      suggestedDids: dids,
    }
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton: { suggestedDids },
}) => {
  return ctx.hydrator.hydrateProfilesDetailed(suggestedDids, ctx)
}

const noBlocksOrMutes: RulesFn<Skeleton, QueryParams> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  skeleton.suggestedDids = skeleton.suggestedDids.filter(
    (did) =>
      !ctx.views.viewerBlockExists(did, hydration) &&
      !ctx.views.viewerMuteExists(did, hydration),
  )
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
}) => {
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
