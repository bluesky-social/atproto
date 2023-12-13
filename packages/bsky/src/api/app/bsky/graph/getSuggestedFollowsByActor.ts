import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getSuggestedFollowsByActor'
import AppContext from '../../../../context'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipelineNew,
} from '../../../../pipeline'
import { Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'

// @TODO fix in tests
export default function (server: Server, ctx: AppContext) {
  const getSuggestedFollowsByActor = createPipelineNew(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.app.bsky.graph.getSuggestedFollowsByActor({
    auth: ctx.authVerifier,
    handler: async ({ auth, params }) => {
      const viewer = auth.credentials.did
      const result = await getSuggestedFollowsByActor(
        { ...params, viewer },
        ctx,
      )
      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton = async (input: SkeletonFnInput<Context, Params>) => {
  const { params, ctx } = input
  const { dids, cursor } = await ctx.hydrator.dataplane.getFollowSuggestions({
    actorDid: params.viewer,
  })
  return {
    suggestedDids: dids,
    cursor: cursor || undefined,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { viewer } = params
  const { suggestedDids } = skeleton
  return ctx.hydrator.hydrateProfilesDetailed(suggestedDids, viewer)
}

const noBlocksOrMutes = (
  input: RulesFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton, hydration } = input
  skeleton.suggestedDids = skeleton.suggestedDids.filter((did) => {
    return (
      !ctx.views.viewerBlockExists(did, hydration) &&
      !ctx.views.viewerMuteExists(did, hydration)
    )
  })
  return skeleton
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, hydration, skeleton } = input
  const { suggestedDids } = skeleton
  const suggestions = mapDefined(suggestedDids, (did) => {
    return ctx.views.profileDetailed(did, hydration)
  })
  return { suggestions }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  viewer: string
}

type SkeletonState = {
  suggestedDids: string[]
}
