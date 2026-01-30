import { mapDefined } from '@atproto/common'
import { AtUriString } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { parseString } from '../../../../hydration/util'
import { app } from '../../../../lexicons/index.js'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline'
import { Views } from '../../../../views'
import { clearlyBadCursor, resHeaders } from '../../../util'

const CURATELIST = app.bsky.graph.defs.curatelist.value
const MODLIST = app.bsky.graph.defs.modlist.value

export default function (server: Server, ctx: AppContext) {
  const getLists = createPipeline(
    skeleton,
    hydration,
    filterPurposes,
    presentation,
  )
  server.add(app.bsky.graph.getLists, {
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
  return {
    listUris: listUris as AtUriString[],
    cursor: parseString(cursor),
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { listUris } = skeleton
  return ctx.hydrator.hydrateLists(listUris, params.hydrateCtx)
}

const filterPurposes = (
  input: RulesFnInput<Context, Params, SkeletonState>,
) => {
  const { skeleton, hydration, params } = input
  const purposes = params.purposes || ['modlist', 'curatelist']

  const acceptedPurposes = new Set()
  if (purposes.includes('modlist')) acceptedPurposes.add(MODLIST)
  if (purposes.includes(MODLIST)) acceptedPurposes.add(MODLIST)
  if (purposes.includes('curatelist')) acceptedPurposes.add(CURATELIST)
  if (purposes.includes(CURATELIST)) acceptedPurposes.add(CURATELIST)

  // @NOTE: While we don't support filtering on the dataplane, this might result in empty pages.
  // Despite the empty pages, the pagination still can enumerate all items for the specified filters.
  skeleton.listUris = skeleton.listUris.filter((uri) => {
    const list = hydration.lists?.get(uri)
    return acceptedPurposes.has(list?.record.purpose)
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

type Params = app.bsky.graph.getLists.Params & {
  hydrateCtx: HydrateCtx
}

type SkeletonState = {
  listUris: AtUriString[]
  cursor?: string
}
