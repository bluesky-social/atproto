import { mapDefined } from '@atproto/common'

import AppContext from '../../../../context.js'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { Server } from '../../../../lexicon/index.js'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getListBlocks.js'
import {
  HydrationFnInput,
  noRules,
  PresentationFnInput,
  SkeletonFnInput,
} from '../../../../pipeline.js'
import { Views } from '../../../../views/index.js'
import { clearlyBadCursor, resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getListMutes = ctx.createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.app.bsky.graph.getListMutes({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const result = await getListMutes(hydrateCtx, params)
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
    await ctx.hydrator.dataplane.getMutelistSubscriptions({
      actorDid: ctx.hydrateCtx.viewer,
      cursor: params.cursor,
      limit: params.limit,
    })
  return { listUris, cursor: cursor || undefined }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton } = input
  return await ctx.hydrator.hydrateLists(skeleton.listUris, ctx.hydrateCtx)
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
  hydrateCtx: HydrateCtx & { viewer: string }
}

type Params = QueryParams

type SkeletonState = {
  listUris: string[]
  cursor?: string
}
