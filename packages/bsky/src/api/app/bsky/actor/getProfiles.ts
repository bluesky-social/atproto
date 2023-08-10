import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { setRepoRev } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfiles({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth, params, res }) => {
      const { actors } = params
      const requester = auth.credentials.did
      const { db, services } = ctx
      const actorService = services.actor(db)

      const [actorsRes, repoRev] = await Promise.all([
        actorService.getActors(actors),
        actorService.getRepoRev(requester),
      ])
      setRepoRev(res, repoRev)

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
