import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { setAtprotoClock } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfiles({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth, params, res }) => {
      const { actors } = params
      const requester = auth.credentials.did
      const { db, services } = ctx
      const actorService = services.actor(db)

      const [actorsRes, actorClock] = await Promise.all([
        actorService.getActors(actors),
        actorService.getActorClock(requester),
      ])

      setAtprotoClock(res, actorClock)
      return {
        encoding: 'application/json',
        body: {
          profiles: await actorService.views.hydrateProfilesDetailed(
            actorsRes,
            requester,
          ),
        },
      }
    },
  })
}
