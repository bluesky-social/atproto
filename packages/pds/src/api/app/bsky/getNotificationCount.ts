import { Server } from '../../../lexicon'
import { AuthRequiredError } from '@atproto/xrpc-server'
import * as GetNotificationCount from '../../../lexicon/types/app/bsky/getNotificationCount'
import * as locals from '../../../locals'
import { countAll } from '../../../db/util'

export default function (server: Server) {
  server.app.bsky.getNotificationCount(
    async (params: GetNotificationCount.QueryParams, _input, req, res) => {
      const { auth, db } = locals.get(res)
      const requester = auth.getUserDid(req)

      if (!requester) {
        throw new AuthRequiredError()
      }

      const result = await db.db
        .selectFrom('user_notification as notif')
        .select(countAll.as('count'))
        .innerJoin('user_did', 'user_did.did', 'notif.userDid')
        .innerJoin('user', 'user.username', 'user_did.username')
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
