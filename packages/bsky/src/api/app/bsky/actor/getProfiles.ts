import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authVerifier } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfiles({
    auth: authVerifier,
    handler: async ({ auth, params }) => {
      const { actors } = params
      const requester = auth.credentials.did
      const { db, services } = ctx
      const actorService = services.actor(db)

      const users = await actorService.getUsers(actors)

      return {
        encoding: 'application/json',
        body: {
          profiles: await actorService.views.profile(users, requester),
        },
      }
    },
  })
}
