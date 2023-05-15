import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfiles({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth, params }) => {
      const { actors } = params
      const requester = auth.credentials.did
      const { db, services } = ctx
      const actorService = services.actor(db)

      const actorsRes = await actorService.getActors(actors)

      return {
        encoding: 'application/json',
        body: {
          profiles: await actorService.views.profileDetailed(
            actorsRes,
            requester,
          ),
        },
      }
    },
  })
}
