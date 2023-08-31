import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { ProfileViewDetailed } from '../../../../lexicon/types/app/bsky/actor/defs'
import { QueryParams } from '../../../../lexicon/types/app/bsky/actor/getProfiles'
import AppContext from '../../../../context'
import { Database } from '../../../../db'
import { Actor } from '../../../../db/tables/actor'
import { ActorService } from '../../../../services/actor'
import { setRepoRev } from '../../../util'
import { createPipeline, noRules } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getProfile = createPipeline(skeleton, hydration, noRules, presentation)
  server.app.bsky.actor.getProfiles({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth, params, res }) => {
      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const viewer = auth.credentials.did

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
  return { params, actors }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const { actorService } = ctx
  const { params, actors } = state
  const { viewer } = params
  const profilesDetailed = await actorService.views.profilesDetailed(
    actors,
    viewer,
  )
  return { ...state, profilesDetailed }
}

const presentation = (state: HydrationState) => {
  const { actors, profilesDetailed } = state
  const profiles = mapDefined(actors, (actor) => profilesDetailed[actor.did])
  return { profiles }
}

type Context = {
  db: Database
  actorService: ActorService
}

type Params = QueryParams & {
  viewer: string | null
}

type SkeletonState = { params: Params; actors: Actor[] }

type HydrationState = SkeletonState & {
  profilesDetailed: Record<string, ProfileViewDetailed>
}
