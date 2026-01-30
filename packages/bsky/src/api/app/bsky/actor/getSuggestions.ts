import { mapDefined, noUndefinedVals } from '@atproto/common'
import { Client, DidString, isDidString } from '@atproto/lex'
import { Headers as HeadersMap, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { DataPlaneClient } from '../../../../data-plane'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { parseString } from '../../../../hydration/util'
import { app } from '../../../../lexicons/index.js'
import { createPipeline } from '../../../../pipeline'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getSuggestions = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.add(app.bsky.actor.getSuggestions, {
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
        { ...params, hydrateCtx, headers },
        ctx,
      )
      const suggestionsResHeaders = noUndefinedVals({
        'content-language': resultHeaders?.get('content-language'),
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

const skeleton = async (input: {
  ctx: Context
  params: Params
}): Promise<Skeleton> => {
  const { ctx, params } = input
  const viewer = params.hydrateCtx.viewer
  if (ctx.suggestionsClient) {
    const res = await ctx.suggestionsClient.xrpc(
      app.bsky.unspecced.getSuggestionsSkeleton,
      {
        headers: params.headers,
        params: {
          viewer: viewer ?? undefined,
          limit: params.limit,
          cursor: params.cursor,
        },
      },
    )
    return {
      dids: res.body.actors.map((a) => a.did),
      cursor: res.body.cursor,
      recId: res.body.recId,
      resHeaders: res.headers,
    }
  } else {
    // @NOTE for appview swap moving to rkey-based cursors which are somewhat permissive, should not hard-break pagination
    const suggestions = await ctx.dataplane.getFollowSuggestions({
      actorDid: viewer ?? undefined,
      cursor: params.cursor,
      limit: params.limit,
    })
    let dids = suggestions.dids.filter(isDidString)
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

const hydration = async (input: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}) => {
  const { ctx, params, skeleton } = input
  return ctx.hydrator.hydrateProfilesDetailed(skeleton.dids, params.hydrateCtx)
}

const noBlocksOrMutes = (input: {
  ctx: Context
  params: Params
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = input
  skeleton.dids = skeleton.dids.filter(
    (did) =>
      !ctx.views.viewerBlockExists(did, hydration) &&
      !ctx.views.viewerMuteExists(did, hydration),
  )
  return skeleton
}

const presentation = (input: {
  ctx: Context
  params: Params
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = input
  const actors = mapDefined(skeleton.dids, (did) =>
    ctx.views.profileKnownFollowers(did, hydration),
  )
  return {
    actors,
    cursor: skeleton.cursor,
    recId: skeleton.recId,
    resHeaders: skeleton.resHeaders,
  }
}

type Context = {
  suggestionsClient: Client | undefined
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
}

type Params = app.bsky.actor.getSuggestions.Params & {
  hydrateCtx: HydrateCtx
  headers: HeadersMap
}

type Skeleton = {
  dids: DidString[]
  cursor?: string
  recId?: number
  resHeaders?: Headers
}
