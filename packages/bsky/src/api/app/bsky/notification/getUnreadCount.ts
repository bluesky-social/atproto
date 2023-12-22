import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { countAll, notSoftDeletedClause } from '../../../../db/util'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.getUnreadCount({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.iss
      if (params.seenAt) {
        throw new InvalidRequestError('The seenAt parameter is unsupported')
      }

      const db = ctx.db.getReplica()
      const { ref } = db.db.dynamic
      const result = await db.db
        .selectFrom('notification')
        .select(countAll.as('count'))
        .innerJoin('actor', 'actor.did', 'notification.did')
        .leftJoin('actor_state', 'actor_state.did', 'actor.did')
        .innerJoin('record', 'record.uri', 'notification.recordUri')
        .where(notSoftDeletedClause(ref('actor')))
        .where(notSoftDeletedClause(ref('record')))
        // Ensure to hit notification_did_sortat_idx, handling case where lastSeenNotifs is null.
        .where('notification.did', '=', requester)
        .where(
          'notification.sortAt',
          '>',
          sql`coalesce(${ref('actor_state.lastSeenNotifs')}, ${''})`,
        )
        .executeTakeFirst()

      const count = result?.count ?? 0

      return {
        encoding: 'application/json',
        body: { count },
      }
    },
  })
}
