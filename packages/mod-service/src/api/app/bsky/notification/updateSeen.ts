import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { excluded } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.updateSeen({
    auth: ctx.authVerifier,
    handler: async ({ input, auth }) => {
      const { seenAt } = input.body
      const viewer = auth.credentials.did

      let parsed: string
      try {
        parsed = new Date(seenAt).toISOString()
      } catch (_err) {
        throw new InvalidRequestError('Invalid date')
      }

      const db = ctx.db.getPrimary()

      await db.db
        .insertInto('actor_state')
        .values({ did: viewer, lastSeenNotifs: parsed })
        .onConflict((oc) =>
          oc.column('did').doUpdateSet({
            lastSeenNotifs: excluded(db.db, 'lastSeenNotifs'),
          }),
        )
        .executeTakeFirst()
    },
  })
}
