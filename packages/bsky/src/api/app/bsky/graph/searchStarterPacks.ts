import { mapDefined } from '@atproto/common'
import { AtUriString, Client } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { DataPlaneClient } from '../../../../data-plane'
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
import { uriToDid as creatorFromUri } from '../../../../util/uris'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const searchStarterPacks = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.add(app.bsky.graph.searchStarterPacks, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        viewer,
        labelers,
        includeTakedowns,
      })
      const results = await searchStarterPacks({ ...params, hydrateCtx }, ctx)
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

  if (ctx.searchClient) {
    // @NOTE cursors won't change on appview swap
    const res = await ctx.searchClient.call(
      app.bsky.unspecced.searchStarterPacksSkeleton,
      {
        q,
        cursor: params.cursor,
        limit: params.limit,
        viewer: params.hydrateCtx.viewer ?? undefined,
      },
    )
    return {
      uris: res.starterPacks.map(({ uri }) => uri),
      cursor: parseString(res.cursor),
    }
  }

  const res = await ctx.dataplane.searchStarterPacks({
    term: q,
    limit: params.limit,
    cursor: params.cursor,
  })
  return {
    uris: res.uris as AtUriString[],
    cursor: parseString(res.cursor),
  }
}

const hydration = async (
  inputs: HydrationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, params, skeleton } = inputs
  return ctx.hydrator.hydrateStarterPacksBasic(skeleton.uris, params.hydrateCtx)
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
    ctx.views.starterPackBasic(uri, hydration),
  )
  return {
    starterPacks: starterPacks,
    cursor: skeleton.cursor,
  }
}

type Context = {
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
  searchClient?: Client
}

type Params = app.bsky.graph.searchStarterPacks.Params & {
  hydrateCtx: HydrateCtx
}

type Skeleton = {
  uris: AtUriString[]
  cursor?: string
}
