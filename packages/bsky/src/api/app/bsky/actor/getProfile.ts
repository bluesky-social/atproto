import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/actor/getProfile'
import { createPipeline, noRules } from '../../../../pipeline'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getProfile = createPipeline(skeleton, hydration, noRules, presentation)
  server.app.bsky.actor.getProfile({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ auth, params, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
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
  const [did] = await ctx.hydrator.actor.getDids([params.actor])
  if (!did) {
    throw new InvalidRequestError('Profile not found')
  }
  return { did }
}

const hydration = async (input: {
  ctx: Context
  params: Params
  skeleton: SkeletonState
}) => {
  const { ctx, params, skeleton } = input
  return ctx.hydrator.hydrateProfilesDetailed(
    [skeleton.did],
    params.hydrateCtx.copy({
      includeActorTakedowns: true,
    }),
  )
}

const presentation = (input: {
  ctx: Context
  params: Params
  skeleton: SkeletonState
  hydration: HydrationState
}) => {
  const { ctx, params, skeleton, hydration } = input
  const profile = ctx.views.profileDetailed(skeleton.did, hydration)
  if (!profile) {
    throw new InvalidRequestError('Profile not found')
  } else if (!params.hydrateCtx.includeTakedowns) {
    if (ctx.views.actorIsTakendown(skeleton.did, hydration)) {
      throw new InvalidRequestError(
        'Account has been suspended',
        'AccountTakedown',
      )
    } else if (ctx.views.actorIsDeactivated(skeleton.did, hydration)) {
      throw new InvalidRequestError(
        'Account is deactivated',
        'AccountDeactivated',
      )
    }
  }
  return profile
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx
}

type SkeletonState = { did: string }
