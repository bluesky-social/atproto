import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getMutes'
import AppContext from '../../../../context'
import { Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline'
import { clearlyBadCursor } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getMutes = createPipeline(skeleton, hydration, noRules, presentation)
  server.app.bsky.graph.getMutes({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth }) => {
      const viewer = auth.credentials.iss
      const result = await getMutes({ ...params, viewer }, ctx)
      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton = async (input: SkeletonFnInput<Context, Params>) => {
  const { params, ctx } = input
  if (clearlyBadCursor(params.cursor)) {
    return { mutedDids: [] }
  }
  const { dids, cursor } = await ctx.hydrator.dataplane.getMutes({
    actorDid: params.viewer,
    cursor: params.cursor,
    limit: params.limit,
  })
  return {
    mutedDids: dids,
    cursor: cursor || undefined,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { viewer } = params
  const { mutedDids } = skeleton
  return ctx.hydrator.hydrateProfiles(mutedDids, viewer)
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, hydration, skeleton } = input
  const { mutedDids, cursor } = skeleton
  const mutes = mapDefined(mutedDids, (did) => {
    return ctx.views.profile(did, hydration)
  })
  return { mutes, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  viewer: string
}

type SkeletonState = {
  mutedDids: string[]
  cursor?: string
}
