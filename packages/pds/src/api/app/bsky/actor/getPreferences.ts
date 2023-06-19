import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getPreferences({
    auth: ctx.accessVerifier,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      const { services, db } = ctx
      const preferences = await services
        .account(db)
        .getPreferences(requester, 'app.bsky')
      return {
        encoding: 'application/json',
        body: { preferences },
      }
    },
  })
}
