import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { ProfileViewDetailed } from '../../../../lexicon/types/app/bsky/actor/defs'
import { QueryParams } from '../../../../lexicon/types/app/bsky/actor/getProfile'
import { softDeleted } from '../../../../db/util'
import AppContext from '../../../../context'
import { Database } from '../../../../db'
import { Actor } from '../../../../db/tables/actor'
import { ActorService } from '../../../../services/actor'
import { setRepoRev } from '../../../util'
import { createPipeline, noRules } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getProfile = createPipeline(skeleton, hydration, noRules, presentation)
  server.app.bsky.actor.getProfile({
    auth: ctx.authOptionalAccessOrRoleVerifier,
    handler: async ({ auth, params, res }) => {
      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const viewer = 'did' in auth.credentials ? auth.credentials.did : null
      const canViewTakendownProfile =
        auth.credentials.type === 'role' && auth.credentials.triage

      const [result, repoRev] = await Promise.allSettled([
        getProfile(
          { ...params, viewer, canViewTakendownProfile },
          { db, actorService },
        ),
        actorService.getRepoRev(viewer),
      ])

      if (repoRev.status === 'fulfilled') {
        setRepoRev(res, repoRev.value)
      }
      if (result.status === 'rejected') {
        throw result.reason
      }

      return {
        encoding: 'application/json',
        body: result.value,
      }
    },
  })
}

const skeleton = async (
  params: Params,
  ctx: Context,
): Promise<SkeletonState> => {
  const { actorService } = ctx
  const { canViewTakendownProfile } = params
  const actor = await actorService.getActor(params.actor, true)
  if (!actor) {
    throw new InvalidRequestError('Profile not found')
  }
  if (!canViewTakendownProfile && softDeleted(actor)) {
    throw new InvalidRequestError(
      'Account has been taken down',
      'AccountTakedown',
    )
  }
  return { params, actor }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const { actorService } = ctx
  const { params, actor } = state
  const { viewer, canViewTakendownProfile } = params
  const profilesDetailed = await actorService.views.profilesDetailed(
    [actor],
    viewer,
    { includeSoftDeleted: canViewTakendownProfile },
  )
  return { ...state, profilesDetailed }
}

const presentation = (state: HydrationState) => {
  const { actor, profilesDetailed } = state
  const profile = profilesDetailed[actor.did]
  if (!profile) {
    throw new InvalidRequestError('Profile not found')
  }
  return profile
}

type Context = {
  db: Database
  actorService: ActorService
}

type Params = QueryParams & {
  viewer: string | null
  canViewTakendownProfile: boolean
}

type SkeletonState = { params: Params; actor: Actor }

type HydrationState = SkeletonState & {
  profilesDetailed: Record<string, ProfileViewDetailed>
}
