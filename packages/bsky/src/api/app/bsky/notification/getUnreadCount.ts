import { Server } from '../../../../lexicon'
import { countAll, notSoftDeletedClause } from '../../../../db/util'
import AppContext from '../../../../context'
import { authVerifier } from '../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.getUnreadCount({
    auth: authVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const { seenAt } = params

      const { ref } = ctx.db.db.dynamic
      const result = await ctx.db.db
        .selectFrom('notification')
        .select(countAll.as('count'))
        .innerJoin('actor', 'actor.did', 'notification.did')
        .innerJoin('record', 'record.uri', 'notification.recordUri')
        .where(notSoftDeletedClause(ref('actor')))
        .where(notSoftDeletedClause(ref('record')))
        .where('notification.did', '=', requester)
        .if(!!seenAt, (qb) =>
          qb.where('notification.sortAt', '>', String(seenAt)),
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
