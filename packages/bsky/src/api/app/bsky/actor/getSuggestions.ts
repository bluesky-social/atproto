import { mapDefined } from '@atproto/common'
import { HeadersMap } from '@atproto/xrpc'

import AppContext from '../../../../context'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon/index'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/actor/getSuggestions'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'

type Skeleton = {
  dids: string[]
  cursor?: string
  resHeaders?: HeadersMap
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getSuggestions({
    auth: ctx.authVerifier.standardOptional,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlocksOrMutes,
      presentation,
      {
        inputHeaders: (req) => ({
          'accept-language': req.headers['accept-language'],
          'x-bsky-topics': Array.isArray(req.headers['x-bsky-topics'])
            ? req.headers['x-bsky-topics'].join(',')
            : req.headers['x-bsky-topics'],
        }),
        outputHeaders: ({ skeleton }) =>
          skeleton.resHeaders?.['content-language']
            ? { 'content-language': skeleton.resHeaders['content-language'] }
            : undefined,
      },
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({
  ctx,
  params,
  headers,
}) => {
  const { viewer } = ctx
  if (ctx.suggestionsAgent) {
    const res =
      await ctx.suggestionsAgent.app.bsky.unspecced.getSuggestionsSkeleton(
        {
          viewer: viewer ?? undefined,
          limit: params.limit,
          cursor: params.cursor,
        },
        { headers },
      )
    return {
      dids: res.data.actors.map((a) => a.did),
      cursor: res.data.cursor,
      resHeaders: res.headers,
    }
  } else {
    // @NOTE for appview swap moving to rkey-based cursors which are somewhat permissive, should not hard-break pagination
    const suggestions = await ctx.dataplane.getFollowSuggestions({
      actorDid: viewer ?? undefined,
      cursor: params.cursor,
      limit: params.limit,
    })
    let dids = suggestions.dids
    if (viewer !== null) {
      const follows = await ctx.dataplane.getActorFollowsActors({
        actorDid: viewer,
        targetDids: dids,
      })
      dids = dids.filter((did, i) => !follows.uris[i] && did !== viewer)
    }
    return { dids, cursor: parseString(suggestions.cursor) }
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  return ctx.hydrator.hydrateProfilesDetailed(skeleton.dids, ctx)
}

const noBlocksOrMutes: RulesFn<Skeleton, QueryParams> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  skeleton.dids = skeleton.dids.filter(
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
  const actors = mapDefined(skeleton.dids, (did) =>
    ctx.views.profileKnownFollowers(did, hydration),
  )
  return {
    actors,
    cursor: skeleton.cursor,
  }
}
