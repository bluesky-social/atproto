import { dedupeStrs, mapDefined } from '@atproto/common'
import { AtUriString } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { app } from '../../../../lexicons/index.js'
import { createPipeline, noRules } from '../../../../pipeline'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getStarterPacks = createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.add(app.bsky.graph.getStarterPacks, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        viewer,
        labelers,
        includeTakedowns,
      })

      const result = await getStarterPacks({ ...params, hydrateCtx }, ctx)

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
  const { ctx, params, skeleton } = input
  return ctx.hydrator.hydrateStarterPacksBasic(
    dedupeStrs(skeleton.uris),
    params.hydrateCtx,
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
}

type Params = app.bsky.graph.getStarterPacks.Params & {
  hydrateCtx: HydrateCtx
}

type SkeletonState = {
  uris: AtUriString[]
}
