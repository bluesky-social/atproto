import { Server } from '../../../../lexicon'
import * as locals from '../../../../locals'
import { countAll } from '../../../../db/util'
import ServerAuth from '../../../../auth'

export default function (server: Server) {
  server.app.bsky.notification.getCount({
    auth: ServerAuth.verifier,
    handler: async ({ auth, res }) => {
      const { db } = locals.get(res)
      const requester = auth.credentials.did

      const result = await db.db
        .selectFrom('user_notification as notif')
        .select(countAll.as('count'))
        .innerJoin('did_handle', 'did_handle.did', 'notif.userDid')
        .innerJoin('user', 'user.handle', 'did_handle.handle')
        .where('did_handle.did', '=', requester)
        .whereRef('notif.indexedAt', '>', 'user.lastSeenNotifs')
        .executeTakeFirst()

      const count = result?.count ?? 0

      return {
        encoding: 'application/json',
        body: { count },
      }
    },
  })
}
