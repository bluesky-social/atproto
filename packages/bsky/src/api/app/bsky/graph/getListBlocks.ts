import { mapDefined } from '@atproto/common'
import { AtUriString } from '@atproto/lex'
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
  const getListBlocks = createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.add(app.bsky.graph.getListBlocks, {
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const result = await getListBlocks(
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
  const { ctx, params } = input
  if (clearlyBadCursor(params.cursor)) {
    return { listUris: [] }
  }
  const { listUris, cursor } =
    await ctx.hydrator.dataplane.getBlocklistSubscriptions({
      actorDid: params.hydrateCtx.viewer,
      cursor: params.cursor,
      limit: params.limit,
    })
  return { listUris: listUris as AtUriString[], cursor: cursor || undefined }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  return await ctx.hydrator.hydrateLists(skeleton.listUris, params.hydrateCtx)
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton, hydration } = input
  const { listUris, cursor } = skeleton
  const lists = mapDefined(listUris, (uri) => ctx.views.list(uri, hydration))
  return { lists, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = app.bsky.graph.getListBlocks.Params & {
  hydrateCtx: HydrateCtx & { viewer: string }
}

type SkeletonState = {
  listUris: AtUriString[]
  cursor?: string
}
