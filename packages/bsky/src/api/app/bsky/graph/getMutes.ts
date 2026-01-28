import { mapDefined } from '@atproto/common'
import { DidString } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { app } from '../../../../lexicons/index.js'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline'
import { Views } from '../../../../views'
import { clearlyBadCursor, resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getMutes = createPipeline(skeleton, hydration, noRules, presentation)
  server.add(app.bsky.graph.getMutes, {
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const result = await getMutes(
        { ...params, hydrateCtx: hydrateCtx.copy({ viewer }) },
        ctx,
      )
      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async (
  input: SkeletonFnInput<Context, Params>,
): Promise<SkeletonState> => {
  const { params, ctx } = input
  if (clearlyBadCursor(params.cursor)) {
    return { mutedDids: [] }
  }
  const { dids, cursor } = await ctx.hydrator.dataplane.getMutes({
    actorDid: params.hydrateCtx.viewer,
    cursor: params.cursor,
    limit: params.limit,
  })
  return {
    mutedDids: dids as DidString[],
    cursor: cursor || undefined,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { mutedDids } = skeleton
  return ctx.hydrator.hydrateProfiles(mutedDids, params.hydrateCtx)
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

type Params = app.bsky.graph.getMutes.Params & {
  hydrateCtx: HydrateCtx & { viewer: string }
}

type SkeletonState = {
  mutedDids: DidString[]
  cursor?: string
}
