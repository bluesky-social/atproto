import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as locals from '../../../../locals'
import ServerAuth from '../../../../auth'

export default function (server: Server) {
  server.app.bsky.notification.updateSeen({
    auth: ServerAuth.verifier,
    handler: async ({ input, auth, res }) => {
      const { seenAt } = input.body
      const { db, services } = locals.get(res)
      const requester = auth.credentials.did

      let parsed: string
      try {
        parsed = new Date(seenAt).toISOString()
      } catch (_err) {
        throw new InvalidRequestError('Invalid date')
      }

      const user = await services.actor(db).getUser(requester)
      if (!user) {
        throw new InvalidRequestError(`Could not find user: ${requester}`)
      }

      await db.db
        .updateTable('user')
        .set({ lastSeenNotifs: parsed })
        .where('handle', '=', user.handle)
        .executeTakeFirst()
    },
  })
}
