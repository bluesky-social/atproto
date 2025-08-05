import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import {
  HydrateCtx,
  Hydrator,
  mergeManyStates,
} from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getStarterPacksWithMembership'
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
  const getStarterPacksWithMembership = createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.app.bsky.graph.getStarterPacksWithMembership({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
      })
      const result = await getStarterPacksWithMembership(
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
    return { actorDid, starterPackUris: [] }
  }

  const { uris: starterPackUris, cursor } =
    await ctx.hydrator.dataplane.getActorStarterPacks({
      actorDid: params.hydrateCtx.viewer,
      cursor: params.cursor,
      limit: params.limit,
    })

  return { actorDid, starterPackUris, cursor: cursor || undefined }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { actorDid, starterPackUris } = skeleton
  const spHydrationState = await ctx.hydrator.hydrateStarterPacks(
    starterPackUris,
    params.hydrateCtx,
  )
  const listUris = mapDefined(
    starterPackUris,
    (uri) => spHydrationState.starterPacks?.get(uri)?.record.list,
  )
  const listMembershipHydrationState =
    await ctx.hydrator.hydrateListsMembership(
      listUris,
      actorDid,
      params.hydrateCtx,
    )
  return mergeManyStates(spHydrationState, listMembershipHydrationState)
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
): OutputSchema => {
  const { ctx, skeleton, hydration } = input
  const { actorDid, starterPackUris, cursor } = skeleton

  const starterPacksWithMembership = mapDefined(starterPackUris, (spUri) => {
    const listUri = hydration.starterPacks?.get(spUri)?.record.list
    const starterPack = ctx.views.starterPack(spUri, hydration)
    if (!listUri || !starterPack) return

    const listItemUri = hydration.listMemberships
      ?.get(listUri)
      ?.get(actorDid)?.actorListItemUri

    return {
      starterPack,
      listItem: listItemUri
        ? ctx.views.listItemView(listItemUri, actorDid, hydration)
        : undefined,
    }
  })
  return { starterPacksWithMembership, cursor }
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
  starterPackUris: string[]
  cursor?: string
}
