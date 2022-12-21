import { Server } from '../../../../lexicon'
import { countAll } from '../../../../db/util'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.getCount({
    auth: ctx.accessVerifier,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did

      const result = await ctx.db.db
        .selectFrom('user_notification as notif')
        .select(countAll.as('count'))
        .innerJoin('did_handle', 'did_handle.did', 'notif.userDid')
        .innerJoin('user', 'user.handle', 'did_handle.handle')
        .innerJoin('did_handle as author', 'author.did', 'notif.author')
        .where('author.takedownId', 'is', null)
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
