import { Server } from '../../../../lexicon'
import { countAll, notSoftDeletedClause } from '../../../../db/util'
import AppContext from '../../../../context'
import { authVerifier } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.getUnreadCount({
    auth: authVerifier,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      const { ref } = ctx.db.db.dynamic

      const result = await ctx.db.db
        .selectFrom('notification')
        .select(countAll.as('count'))
        .innerJoin('actor', 'actor.did', 'notification.did')
        .innerJoin('record', 'record.uri', 'notif.recordUri')
        .where(notSoftDeletedClause(ref('author_repo')))
        .where(notSoftDeletedClause(ref('record')))
        .where('notif.did', '=', requester)
        .whereRef('notif.indexedAt', '>', 'user_state.lastSeenNotifs')
        .executeTakeFirst()

      const count = result?.count ?? 0

      return {
        encoding: 'application/json',
        body: { count },
      }
    },
  })
}
