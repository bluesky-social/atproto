import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { countAll, notSoftDeletedClause } from '../../../../db/util'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.getUnreadCount({
    auth: ctx.authVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      if (params.seenAt) {
        throw new InvalidRequestError('The seenAt parameter is unsupported')
      }

      const { ref } = ctx.db.db.dynamic
      const result = await ctx.db.db
        .selectFrom('notification')
        .select(countAll.as('count'))
        .innerJoin('actor', 'actor.did', 'notification.did')
        .leftJoin('actor_state', 'actor_state.did', 'actor.did')
        .innerJoin('record', 'record.uri', 'notification.recordUri')
        .where(notSoftDeletedClause(ref('actor')))
        .where(notSoftDeletedClause(ref('record')))
        .where('notification.did', '=', requester)
        .where((inner) =>
          inner
            .where('actor_state.lastSeenNotifs', 'is', null)
            .orWhereRef(
              'notification.sortAt',
              '>',
              'actor_state.lastSeenNotifs',
            ),
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
