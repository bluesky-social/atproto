import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context.js'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { Server } from '../../../../lexicon/index.js'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getStarterPack.js'
import {
  HydrationFnInput,
  noRules,
  PresentationFnInput,
  SkeletonFnInput,
} from '../../../../pipeline.js'
import { Views } from '../../../../views/index.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getStarterPack = ctx.createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.app.bsky.graph.getStarterPack({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
      })
      const result = await getStarterPack(hydrateCtx, params)
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
  const uri = await ctx.hydrator.resolveUri(params.starterPack)
  return { uri }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton } = input
  return ctx.hydrator.hydrateStarterPacks([skeleton.uri], ctx.hydrateCtx)
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton, hydration } = input
  const starterPack = ctx.views.starterPack(skeleton.uri, hydration)
  if (!starterPack) {
    throw new InvalidRequestError('Starter pack not found')
  }
  return { starterPack }
}

type Context = {
  hydrator: Hydrator
  views: Views
  hydrateCtx: HydrateCtx
}

type Params = QueryParams

type SkeletonState = {
  uri: string
}
