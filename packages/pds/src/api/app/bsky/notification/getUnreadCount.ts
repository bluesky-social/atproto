import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { countAll, notSoftDeletedClause } from '../../../../db/util'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.getUnreadCount({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const { seenAt } = params
      const requester = auth.credentials.did
      const { ref } = ctx.db.db.dynamic
      if (seenAt) {
        throw new InvalidRequestError('The seenAt parameter is unsupported')
      }

      const result = await ctx.db.db
        .selectFrom('user_notification as notif')
        .select(countAll.as('count'))
        .innerJoin('user_account', 'user_account.did', 'notif.userDid')
        .innerJoin('user_state', 'user_state.did', 'user_account.did')
        .innerJoin(
          'repo_root as author_repo',
          'author_repo.did',
          'notif.author',
        )
        .innerJoin('record', 'record.uri', 'notif.recordUri')
        .where(notSoftDeletedClause(ref('author_repo')))
        .where(notSoftDeletedClause(ref('record')))
        .where('notif.userDid', '=', requester)
        .whereNotExists(
          ctx.db.db // Omit mentions and replies by muted actors
            .selectFrom('mute')
            .selectAll()
            .whereRef('did', '=', ref('notif.author'))
            .where('mutedByDid', '=', requester),
        )
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
