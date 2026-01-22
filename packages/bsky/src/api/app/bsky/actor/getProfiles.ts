import { mapDefined } from '@atproto/common'
import { DidString } from '@atproto/syntax'
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
  const getProfile = createPipeline(skeleton, hydration, noRules, presentation)
  server.add(app.bsky.actor.getProfiles, {
    auth: ctx.authVerifier.standardOptionalParameterized({
      lxmCheck: (method) => {
        if (!method) return false
        return (
          method === app.bsky.actor.getProfiles.$lxm ||
          method.startsWith('chat.bsky.')
        )
      },
    }),
    handler: async ({ auth, params, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        viewer,
        labelers,
        includeTakedowns,
      })

      const result = await getProfile({ ...params, hydrateCtx }, ctx)

      const repoRev = await ctx.hydrator.actor.getRepoRevSafe(viewer)

      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({
          repoRev,
          labelers: hydrateCtx.labelers,
        }),
      }
    },
  })
}

const skeleton = async (input: {
  ctx: Context
  params: Params
}): Promise<SkeletonState> => {
  const { ctx, params } = input
  const dids = await ctx.hydrator.actor.getDidsDefined(params.actors)
  return { dids }
}

const hydration = async (input: {
  ctx: Context
  params: Params
  skeleton: SkeletonState
}) => {
  const { ctx, params, skeleton } = input
  return ctx.hydrator.hydrateProfilesDetailed(skeleton.dids, params.hydrateCtx)
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

type Params = app.bsky.actor.getProfiles.Params & {
  hydrateCtx: HydrateCtx
}

type SkeletonState = { dids: DidString[] }
