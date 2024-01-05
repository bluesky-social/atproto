import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/actor/getProfiles'
import AppContext from '../../../../context'
import { Database } from '../../../../db'
import {
  ActorService,
  ProfileDetailHydrationState,
} from '../../../../services/actor'
import { setRepoRev } from '../../../util'
import { createPipeline, noRules } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getProfile = createPipeline(skeleton, hydration, noRules, presentation)
  server.app.bsky.actor.getProfiles({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, res }) => {
      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const viewer = auth.credentials.iss

      const [result, repoRev] = await Promise.all([
        getProfile({ ...params, viewer }, { db, actorService }),
        actorService.getRepoRev(viewer),
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
  params: Params,
  ctx: Context,
): Promise<SkeletonState> => {
  const { actorService } = ctx
  const actors = await actorService.getActors(params.actors)
  return { params, dids: actors.map((a) => a.did) }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const { actorService } = ctx
  const { params, dids } = state
  const { viewer } = params
  const hydration = await actorService.views.profileDetailHydration(dids, {
    viewer,
  })
  return { ...state, ...hydration }
}

const presentation = (state: HydrationState, ctx: Context) => {
  const { actorService } = ctx
  const { params, dids } = state
  const { viewer } = params
  const profiles = actorService.views.profileDetailPresentation(dids, state, {
    viewer,
  })
  const profileViews = mapDefined(dids, (did) => profiles[did])
  return { profiles: profileViews }
}

type Context = {
  db: Database
  actorService: ActorService
}

type Params = QueryParams & {
  viewer: string | null
}

type SkeletonState = { params: Params; dids: string[] }

type HydrationState = SkeletonState & ProfileDetailHydrationState
