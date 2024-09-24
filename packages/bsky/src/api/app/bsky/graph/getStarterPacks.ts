import { dedupeStrs, mapDefined } from '@atproto/common'

import AppContext from '../../../../context.js'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator.js'
import { Server } from '../../../../lexicon/index.js'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getStarterPacks.js'
import { noRules } from '../../../../pipeline.js'
import { Views } from '../../../../views/index.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getStarterPacks = ctx.createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.app.bsky.graph.getStarterPacks({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        viewer,
        labelers,
        includeTakedowns,
      })

      const result = await getStarterPacks(hydrateCtx, params)

      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async (inputs: { params: Params }) => {
  return { uris: inputs.params.uris }
}

const hydration = async (input: {
  ctx: Context
  params: Params
  skeleton: SkeletonState
}) => {
  const { ctx, skeleton } = input
  return ctx.hydrator.hydrateStarterPacksBasic(
    dedupeStrs(skeleton.uris),
    ctx.hydrateCtx,
  )
}

const presentation = (input: {
  ctx: Context
  params: Params
  skeleton: SkeletonState
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = input
  const starterPacks = mapDefined(skeleton.uris, (did) =>
    ctx.views.starterPackBasic(did, hydration),
  )
  return { starterPacks }
}

type Context = {
  hydrator: Hydrator
  views: Views
  hydrateCtx: HydrateCtx
}

type Params = QueryParams

type SkeletonState = { uris: string[] }
