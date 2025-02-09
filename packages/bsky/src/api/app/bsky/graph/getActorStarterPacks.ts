import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { DataPlaneClient } from '../../../../data-plane'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getActorStarterPacks'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getActorStarterPacks = createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.app.bsky.graph.getActorStarterPacks({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
      })
      const result = await getActorStarterPacks({ ...params, hydrateCtx }, ctx)
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
  const [did] = await ctx.hydrator.actor.getDids([params.actor])
  if (!did) {
    throw new InvalidRequestError('Profile not found')
  }
  const starterPacks = await ctx.dataplane.getActorStarterPacks({
    actorDid: did,
    cursor: params.cursor,
    limit: params.limit,
  })
  return {
    starterPackUris: starterPacks.uris,
    cursor: parseString(starterPacks.cursor),
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  return ctx.hydrator.hydrateStarterPacksBasic(
    skeleton.starterPackUris,
    params.hydrateCtx,
  )
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton, hydration } = input
  const starterPacks = mapDefined(skeleton.starterPackUris, (uri) =>
    ctx.views.starterPackBasic(uri, hydration),
  )
  return {
    starterPacks,
    cursor: skeleton.cursor,
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
  dataplane: DataPlaneClient
}

type Params = QueryParams & { hydrateCtx: HydrateCtx }

type SkeletonState = {
  starterPackUris: string[]
  cursor?: string
}
