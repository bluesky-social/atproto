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
  if (clearlyBadCursor(params.cursor)) {
    return { listUris: [], starterPackUris: [] }
  }

  const [did] = await ctx.hydrator.actor.getDids([params.actor])
  if (!did) throw new InvalidRequestError('Profile not found')

  const { uris: starterPackUris, cursor } =
    await ctx.hydrator.dataplane.getActorStarterPacks({
      actorDid: params.hydrateCtx.viewer,
      cursor: params.cursor,
      limit: params.limit,
    })

  const starterPackRecords =
    await ctx.hydrator.graph.getStarterPacks(starterPackUris)
  const listUris = mapDefined([...starterPackRecords.values()], (sp) => {
    if (!sp) return
    return sp.record.list
  })

  return { listUris, starterPackUris, cursor: cursor || undefined }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { actor } = params
  const { listUris, starterPackUris } = skeleton
  const [spHydrationState, listMembershipHydrationState] = await Promise.all([
    ctx.hydrator.hydrateStarterPacksBasic(starterPackUris, params.hydrateCtx),
    ctx.hydrator.hydrateListsMembership(listUris, actor, params.hydrateCtx),
  ])
  return mergeManyStates(spHydrationState, listMembershipHydrationState)
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
): OutputSchema => {
  const { ctx, params, skeleton, hydration } = input
  const { listUris, starterPackUris: spUri, cursor } = skeleton

  let i = 0
  const starterPacksWithMembership = mapDefined(spUri, (starterPackUri) => {
    const listUri = listUris[i++]
    const starterPack = ctx.views.starterPackBasic(starterPackUri, hydration)
    if (!starterPack) return

    const listItemUri = hydration.listMemberships
      ?.get(listUri)
      ?.get(params.actor)?.actorListItemUri

    return {
      starterPack,
      listItem: listItemUri
        ? ctx.views.listItemView(listItemUri, params.actor, hydration)
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
  listUris: string[]
  starterPackUris: string[]
  cursor?: string
}
