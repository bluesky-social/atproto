import { mapDefined } from '@atproto/common'
import type { AtUriString } from '@atproto/lex'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import {
  type DataPlaneClient,
  asInvalidRequest,
} from '../../../../data-plane/index.js'
import type { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { parseString } from '../../../../hydration/util.js'
import { app } from '../../../../lexicons/index.js'
import {
  type HydrationFnInput,
  type PresentationFnInput,
  type RulesFnInput,
  type SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline.js'
import { uriToDid as creatorFromUri } from '../../../../util/uris.js'
import type { Views } from '../../../../views/index.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const searchStarterPacksV2 = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.add(app.bsky.graph.searchStarterPacksV2, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const { viewer, includeTakedowns, skipViewerBlocks } =
        ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        viewer,
        labelers,
        includeTakedowns,
        skipViewerBlocks,
        features: ctx.featureGatesClient.scope(
          ctx.featureGatesClient.parseUserContextFromHandler({
            viewer,
            req,
          }),
        ),
      })

      const results = await searchStarterPacksV2({ ...params, hydrateCtx }, ctx)
      return {
        encoding: 'application/json',
        body: results,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async (
  inputs: SkeletonFnInput<Context, Params>,
): Promise<Skeleton> => {
  const { ctx, params } = inputs
  const { q } = params

  // Surface dataplane InvalidArgument errors as a 400 rather than a 500.
  const res = await ctx.dataplane
    .searchStarterPacksV2({
      params: {
        query: q,
        viewer: params.hydrateCtx.viewer ?? undefined,
        limit: params.limit,
        cursor: params.cursor,
      },
    })
    .catch(asInvalidRequest())
  return {
    uris: res.starterPacks.map(({ uri }) => uri as AtUriString),
    cursor: parseString(res.pageInfo?.cursor),
    hitsTotal: res.pageInfo?.hitsTotal
      ? Number(res.pageInfo.hitsTotal)
      : undefined,
  }
}

const hydration = async (
  inputs: HydrationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, params, skeleton } = inputs
  return ctx.hydrator.hydrateStarterPacks(skeleton.uris, params.hydrateCtx)
}

const noBlocks = (inputs: RulesFnInput<Context, Params, Skeleton>) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.uris = skeleton.uris.filter((uri) => {
    const creator = creatorFromUri(uri)
    return !ctx.views.viewerBlockExists(creator, hydration)
  })
  return skeleton
}

const presentation = (
  inputs: PresentationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, skeleton, hydration } = inputs
  const starterPacks = mapDefined(skeleton.uris, (uri) =>
    ctx.views.starterPack(uri, hydration),
  )
  return {
    starterPacks,
    cursor: skeleton.cursor,
    hitsTotal: skeleton.hitsTotal,
  }
}

type Context = {
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
}

type Params = app.bsky.graph.searchStarterPacksV2.$Params & {
  hydrateCtx: HydrateCtx
}

type Skeleton = {
  uris: AtUriString[]
  cursor?: string
  hitsTotal?: number
}
