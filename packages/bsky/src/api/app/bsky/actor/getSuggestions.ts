import { AtpAgent } from '@atproto/api'
import { mapDefined, noUndefinedVals } from '@atproto/common'

import AppContext from '../../../../context.js'
import { DataPlaneClient } from '../../../../data-plane/index.js'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { parseString } from '../../../../hydration/util.js'
import { Server } from '../../../../lexicon/index.js'
import { QueryParams } from '../../../../lexicon/types/app/bsky/actor/getSuggestions.js'
import {
  HydrationFn,
  PresentationFnInput,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline.js'
import { Views } from '../../../../views/index.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getSuggestions = ctx.createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.app.bsky.actor.getSuggestions({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ viewer, labelers })
      const headers = noUndefinedVals({
        'accept-language': req.headers['accept-language'],
        'x-bsky-topics': Array.isArray(req.headers['x-bsky-topics'])
          ? req.headers['x-bsky-topics'].join(',')
          : req.headers['x-bsky-topics'],
      })
      const { resHeaders: resultHeaders, ...result } = await getSuggestions(
        hydrateCtx,
        params,
        headers,
      )
      const suggestionsResHeaders = noUndefinedVals({
        'content-language': resultHeaders?.['content-language'],
      })
      return {
        encoding: 'application/json',
        body: result,
        headers: {
          ...suggestionsResHeaders,
          ...resHeaders({ labelers: hydrateCtx.labelers }),
        },
      }
    },
  })
}

const skeleton: SkeletonFn<Context, Params, Skeleton> = async ({
  ctx,
  params,
  headers,
}) => {
  const viewer = ctx.hydrateCtx.viewer
  if (ctx.suggestionsAgent) {
    const res =
      await ctx.suggestionsAgent.api.app.bsky.unspecced.getSuggestionsSkeleton(
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

const hydration: HydrationFn<Context, Params, Skeleton> = async ({
  ctx,
  skeleton,
}) => {
  return ctx.hydrator.hydrateProfilesDetailed(skeleton.dids, ctx.hydrateCtx)
}

const noBlocksOrMutes: RulesFn<Context, Params, Skeleton> = ({
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

const presentation = ({
  ctx,
  skeleton,
  hydration,
}: PresentationFnInput<Context, Params, Skeleton>) => {
  const actors = mapDefined(skeleton.dids, (did) =>
    ctx.views.profileKnownFollowers(did, hydration),
  )
  return {
    actors,
    cursor: skeleton.cursor,
    resHeaders: skeleton.resHeaders,
  }
}

type Context = {
  suggestionsAgent?: AtpAgent
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
  hydrateCtx: HydrateCtx
}

type Params = QueryParams

type Skeleton = {
  dids: string[]
  cursor?: string
  resHeaders?: Record<string, string>
}
