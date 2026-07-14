import { mapDefined } from '@atproto/common'
import type { AtUriString } from '@atproto/syntax'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import type { DataPlaneClient } from '../../../../data-plane/index.js'
import type { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { parseString } from '../../../../hydration/util.js'
import { app } from '../../../../lexicons/index.js'
import {
  type HydrationFnInput,
  type PresentationFnInput,
  type SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline.js'
import type { Views } from '../../../../views/index.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getActorStarterPacks = createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.add(app.bsky.graph.getActorStarterPacks, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns, skipViewerBlocks } =
        ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
        skipViewerBlocks,
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
    starterPackUris: starterPacks.uris as AtUriString[],
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

type Params = app.bsky.graph.getActorStarterPacks.$Params & {
  hydrateCtx: HydrateCtx
}

type SkeletonState = {
  starterPackUris: AtUriString[]
  cursor?: string
}
