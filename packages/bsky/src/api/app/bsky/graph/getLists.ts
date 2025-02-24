import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { REFERENCELIST } from '../../../../lexicon/types/app/bsky/graph/defs'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getLists'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline'
import { Views } from '../../../../views'
import { clearlyBadCursor, resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getLists = createPipeline(
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
      const result = await getLists({ ...params, hydrateCtx }, ctx)

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

  const [did] = await ctx.hydrator.actor.getDids([params.actor])
  if (!did) throw new InvalidRequestError('Profile not found')

  const { listUris, cursor } = await ctx.hydrator.dataplane.getActorLists({
    actorDid: did,
    cursor: params.cursor,
    limit: params.limit,
  })
  return { listUris, cursor: cursor || undefined }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { listUris } = skeleton
  return ctx.hydrator.hydrateLists(listUris, params.hydrateCtx)
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
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx
}

type SkeletonState = {
  listUris: string[]
  cursor?: string
}
