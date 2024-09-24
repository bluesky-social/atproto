import { mapDefined } from '@atproto/common'

import AppContext from '../../../../context.js'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { Server } from '../../../../lexicon/index.js'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getMutes.js'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  noRules,
} from '../../../../pipeline.js'
import { Views } from '../../../../views/index.js'
import { clearlyBadCursor, resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getMutes = ctx.createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )

  server.app.bsky.graph.getMutes({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const result = await getMutes(hydrateCtx, params)
      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
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
    actorDid: ctx.hydrateCtx.viewer,
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
  const { ctx, skeleton } = input
  const { mutedDids } = skeleton
  return ctx.hydrator.hydrateProfiles(mutedDids, ctx.hydrateCtx)
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
  hydrateCtx: HydrateCtx & { viewer: string }
}

type Params = QueryParams

type SkeletonState = {
  mutedDids: string[]
  cursor?: string
}
