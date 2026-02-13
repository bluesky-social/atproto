import { mapDefined } from '@atproto/common'
import { AtUriString, DidString } from '@atproto/syntax'
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
  const getBlocks = createPipeline(skeleton, hydration, noRules, presentation)
  server.add(app.bsky.graph.getBlocks, {
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const result = await getBlocks(
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
    return { blockedDids: [] }
  }
  const { blockUris, cursor } = (await ctx.hydrator.dataplane.getBlocks({
    actorDid: params.hydrateCtx.viewer,
    cursor: params.cursor,
    limit: params.limit,
  })) as {
    blockUris: AtUriString[]
    cursor?: string
  }
  const blocks = await ctx.hydrator.graph.getBlocks(blockUris)
  const blockedDids = mapDefined(
    blockUris,
    (uri) => blocks.get(uri)?.record.subject,
  )
  return {
    blockedDids,
    cursor: cursor || undefined,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  return ctx.hydrator.hydrateProfiles(skeleton.blockedDids, params.hydrateCtx)
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, hydration, skeleton } = input
  const { blockedDids, cursor } = skeleton
  const blocks = mapDefined(blockedDids, (did) => {
    return ctx.views.profile(did, hydration)
  })
  return { blocks, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = app.bsky.graph.getBlocks.Params & {
  hydrateCtx: HydrateCtx & { viewer: string }
}

type SkeletonState = {
  blockedDids: DidString[]
  cursor?: string
}
