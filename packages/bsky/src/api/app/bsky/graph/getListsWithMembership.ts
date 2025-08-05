import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import {
  CURATELIST,
  MODLIST,
} from '../../../../lexicon/types/app/bsky/graph/defs'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getListsWithMembership'
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
  const getListsWithMembership = createPipeline(
    skeleton,
    hydration,
    filterPurposes,
    presentation,
  )
  server.app.bsky.graph.getListsWithMembership({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
      })
      const result = await getListsWithMembership(
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
  const [actorDid] = await ctx.hydrator.actor.getDids([params.actor])
  if (!actorDid) throw new InvalidRequestError('Profile not found')

  if (clearlyBadCursor(params.cursor)) {
    return { actorDid, listUris: [] }
  }

  const { listUris, cursor } = await ctx.hydrator.dataplane.getActorLists({
    actorDid: params.hydrateCtx.viewer,
    cursor: params.cursor,
    limit: params.limit,
  })
  return { actorDid, listUris, cursor: cursor || undefined }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { actorDid, listUris } = skeleton
  return ctx.hydrator.hydrateListsMembership(
    listUris,
    actorDid,
    params.hydrateCtx,
  )
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
  const { actorDid, listUris, cursor } = skeleton
  const listsWithMembership = mapDefined(listUris, (uri) => {
    const list = ctx.views.list(uri, hydration)
    if (!list) return

    const listItemUri = hydration.listMemberships
      ?.get(uri)
      ?.get(actorDid)?.actorListItemUri

    return {
      list,
      listItem: listItemUri
        ? ctx.views.listItemView(listItemUri, actorDid, hydration)
        : undefined,
    }
  })
  return { listsWithMembership, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx & { viewer: string }
}

type SkeletonState = {
  actorDid: string
  listUris: string[]
  cursor?: string
}
