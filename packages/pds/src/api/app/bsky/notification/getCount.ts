import { Server } from '../../../../lexicon'
import { AuthRequiredError } from '@atproto/xrpc-server'
import * as GetCount from '../../../../lexicon/types/app/bsky/notification/getCount'
import * as locals from '../../../../locals'
import { countAll } from '../../../../db/util'

export default function (server: Server) {
  server.app.bsky.notification.getCount(
    async (params: GetCount.QueryParams, _input, req, res) => {
      const { auth, db } = locals.get(res)
      const requester = auth.getUserDid(req)

      if (!requester) {
        throw new AuthRequiredError()
      }

      const result = await db.db
        .selectFrom('user_notification as notif')
        .select(countAll.as('count'))
        .innerJoin('user_did', 'user_did.did', 'notif.userDid')
        .innerJoin('user', 'user.handle', 'user_did.handle')
        .where('user_did.did', '=', requester)
        .whereRef('notif.indexedAt', '>', 'user.lastSeenNotifs')
        .executeTakeFirst()

      const count = result?.count ?? 0

      return {
        encoding: 'application/json',
        body: { count },
      }
    },
  )
}
