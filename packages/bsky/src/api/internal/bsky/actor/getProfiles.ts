import { mapDefined } from '@atproto/common'
import type { DidString } from '@atproto/syntax'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import type {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator.js'
import { internal } from '../../../../lexicons/index.js'
import { createPipeline, noRules } from '../../../../pipeline.js'
import type { Views } from '../../../../views/index.js'

export default function (server: Server, ctx: AppContext) {
  const getProfiles = createPipeline(skeleton, hydration, noRules, presentation)
  server.add(internal.bsky.actor.getProfiles, {
    auth: ctx.authVerifier.role,
    handler: async ({ params, req }) => {
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        viewer: params.viewer ?? null,
        labelers,
        includeTakedowns: params.includeTakedowns,
      })

      const result = await getProfiles({ ...params, hydrateCtx }, ctx)

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton = async (input: {
  ctx: Context
  params: Params
}): Promise<SkeletonState> => {
  const { params } = input
  const dids = params.dids
  const didSet = new Set(dids)
  // social proof is only hydrated for dids present in both inputs
  const socialProofDids = (params.socialProof ?? []).filter((did) =>
    didSet.has(did),
  )
  return { dids, socialProofDids }
}

const hydration = async (input: {
  ctx: Context
  params: Params
  skeleton: SkeletonState
}) => {
  const { ctx, params, skeleton } = input
  return ctx.hydrator.hydrateProfilesDetailed(
    skeleton.dids,
    params.hydrateCtx,
    { knownFollowersDids: skeleton.socialProofDids },
  )
}

const presentation = (input: {
  ctx: Context
  params: Params
  skeleton: SkeletonState
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = input
  const profiles = mapDefined(skeleton.dids, (did) =>
    ctx.views.profileDetailed(did, hydration),
  )
  return { profiles }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = internal.bsky.actor.getProfiles.$Params & {
  hydrateCtx: HydrateCtx
}

type SkeletonState = {
  dids: DidString[]
  socialProofDids: DidString[]
}
