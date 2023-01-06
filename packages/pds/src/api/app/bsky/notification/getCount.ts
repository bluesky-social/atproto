import { Server } from '../../../../lexicon'
import { countAll, notSoftDeletedClause } from '../../../../db/util'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.getCount({
    auth: ctx.accessVerifier,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      const { ref } = ctx.db.db.dynamic

      const result = await ctx.db.db
        .selectFrom('user_notification as notif')
        .select(countAll.as('count'))
        .innerJoin('did_handle', 'did_handle.did', 'notif.userDid')
        .innerJoin('user', 'user.handle', 'did_handle.handle')
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
            .where(ref('notif.reason'), 'in', ['mention', 'reply'])
            .whereRef('did', '=', ref('notif.author'))
            .where('mutedByDid', '=', requester),
        )
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
