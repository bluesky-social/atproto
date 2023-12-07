import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/actor/getProfile'
import AppContext from '../../../../context'
import { setRepoRev } from '../../../util'
import { createPipelineNew, noRulesNew } from '../../../../pipeline'
import { HydrationState, Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'

export default function (server: Server, ctx: AppContext) {
  const getProfile = createPipelineNew(
    skeleton,
    hydration,
    noRulesNew,
    presentation,
  )
  server.app.bsky.actor.getProfile({
    auth: ctx.authOptionalAccessOrRoleVerifier,
    handler: async ({ auth, params, res }) => {
      const viewer = 'did' in auth.credentials ? auth.credentials.did : null
      const canViewTakendownProfile =
        auth.credentials.type === 'role' && auth.credentials.triage

      const [result, repoRev] = await Promise.all([
        getProfile({ ...params, viewer, canViewTakendownProfile }, ctx),
        ctx.hydrator.actor.getRepoRevSafe(viewer),
      ])

      setRepoRev(res, repoRev)

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton = async (
  ctx: Context,
  params: Params,
): Promise<SkeletonState> => {
  // const { canViewTakendownProfile } = params
  const [did] = await ctx.hydrator.actor.getDids([params.actor])
  if (!did) {
    throw new InvalidRequestError('Profile not found')
  }
  // if (!canViewTakendownProfile && softDeleted(actor)) {
  //   throw new InvalidRequestError(
  //     'Account has been taken down',
  //     'AccountTakedown',
  //   )
  // }
  return { did }
}

const hydration = async (
  ctx: Context,
  params: Params,
  skele: SkeletonState,
) => {
  return ctx.hydrator.hydrateProfilesDetailed([skele.did], params.viewer)
}

const presentation = (
  ctx: Context,
  skele: SkeletonState,
  hydration: HydrationState,
) => {
  const profile = ctx.views.profileDetailed(skele.did, hydration)
  if (!profile) {
    throw new InvalidRequestError('Profile not found')
  }
  return profile
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  viewer: string | null
  canViewTakendownProfile: boolean
}

type SkeletonState = { did: string }
