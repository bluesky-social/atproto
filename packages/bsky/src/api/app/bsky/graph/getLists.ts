import { mapDefined } from '@atproto/common'

import AppContext from '../../../../context.js'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { Server } from '../../../../lexicon/index.js'
import { REFERENCELIST } from '../../../../lexicon/types/app/bsky/graph/defs.js'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getLists.js'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
} from '../../../../pipeline.js'
import { Views } from '../../../../views/index.js'
import { clearlyBadCursor, resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getLists = ctx.createPipeline(
    skeleton,
    hydration,
    noReferenceLists,
    presentation,
  )
  server.app.bsky.graph.getLists({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth, req }) => {
      const labelers = ctx.reqLabelers(req)
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
      })
      const result = await getLists(hydrateCtx, params)

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
  const { listUris, cursor } = await ctx.hydrator.dataplane.getActorLists({
    actorDid: params.actor,
    cursor: params.cursor,
    limit: params.limit,
  })
  return { listUris, cursor: cursor || undefined }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton } = input
  const { listUris } = skeleton
  return ctx.hydrator.hydrateLists(listUris, ctx.hydrateCtx)
}

const noReferenceLists = (
  input: RulesFnInput<Context, Params, SkeletonState>,
) => {
  const { skeleton, hydration } = input
  skeleton.listUris = skeleton.listUris.filter((uri) => {
    const list = hydration.lists?.get(uri)
    return list?.record.purpose !== REFERENCELIST
  })
  return skeleton
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton, hydration } = input
  const { listUris, cursor } = skeleton
  const lists = mapDefined(listUris, (uri) => {
    return ctx.views.list(uri, hydration)
  })
  return { lists, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
  hydrateCtx: HydrateCtx
}

type Params = QueryParams

type SkeletonState = {
  listUris: string[]
  cursor?: string
}
