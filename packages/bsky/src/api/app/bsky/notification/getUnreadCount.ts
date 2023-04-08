import { Server } from '../../../../lexicon'
import { countAll, notSoftDeletedClause } from '../../../../db/util'
import AppContext from '../../../../context'
import { authVerifier } from '../util'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.getUnreadCount({
    auth: authVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const { seenAt } = params
      if (!seenAt) {
        throw new InvalidRequestError('Missing "seenAt" param')
      }

      const { ref } = ctx.db.db.dynamic
      const result = await ctx.db.db
        .selectFrom('notification')
        .select(countAll.as('count'))
        .innerJoin('actor', 'actor.did', 'notification.did')
        .innerJoin('record', 'record.uri', 'notification.recordUri')
        .where(notSoftDeletedClause(ref('actor')))
        .where(notSoftDeletedClause(ref('record')))
        .where('notification.did', '=', requester)
        .where('notification.sortAt', '>', seenAt)
        .executeTakeFirst()

      const count = result?.count ?? 0

      return {
        encoding: 'application/json',
        body: { count },
      }
    },
  })
}
