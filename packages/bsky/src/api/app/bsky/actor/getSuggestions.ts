import { mapDefined } from '@atproto/common'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/actor/getSuggestions'
import { createPipeline } from '../../../../pipeline'
import { HydrationState, Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { DataPlaneClient } from '../../../../data-plane'
import { parseString } from '../../../../hydration/util'

export default function (server: Server, ctx: AppContext) {
  const getSuggestions = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.app.bsky.actor.getSuggestions({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth }) => {
      const viewer = auth.credentials.iss
      const result = await getSuggestions({ ...params, viewer }, ctx)

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton = async (input: {
  ctx: Context
  params: Params
}): Promise<Skeleton> => {
  const { ctx, params } = input
  // @NOTE for appview swap moving to rkey-based cursors which are somewhat permissive, should not hard-break pagination
  const suggestions = await ctx.dataplane.getFollowSuggestions({
    actorDid: params.viewer ?? undefined,
    cursor: params.cursor,
    limit: params.limit,
  })
  let dids = suggestions.dids
  if (params.viewer !== null) {
    const follows = await ctx.dataplane.getActorFollowsActors({
      actorDid: params.viewer,
      targetDids: dids,
    })
    dids = dids.filter((did, i) => !follows.uris[i] && did !== params.viewer)
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
    params.viewer,
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
  viewer: string | null
}

type Skeleton = { dids: string[]; cursor?: string }
