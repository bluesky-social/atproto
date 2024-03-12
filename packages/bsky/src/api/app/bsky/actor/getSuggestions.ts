import { mapDefined } from '@atproto/common'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/actor/getSuggestions'
import { createPipeline } from '../../../../pipeline'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { DataPlaneClient } from '../../../../data-plane'
import { parseString } from '../../../../hydration/util'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getSuggestions = createPipeline(
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
      const hydrateCtx = { viewer, labelers }
      const result = await getSuggestions({ ...params, hydrateCtx }, ctx)

      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers }),
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

const hydration = async (input: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}) => {
  const { ctx, params, skeleton } = input
  return ctx.hydrator.hydrateProfilesDetailed(
    skeleton.dids,
    params.hydrateCtx,
    true,
  )
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
    ctx.views.profile(did, hydration),
  )
  return {
    actors,
    cursor: skeleton.cursor,
  }
}

type Context = {
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx
}

type Skeleton = { dids: string[]; cursor?: string }
