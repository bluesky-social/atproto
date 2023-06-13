import { sql } from 'kysely'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { ListKeyset } from '../../../../services/account'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchRepos({
    auth: ctx.moderatorVerifier,
    handler: async ({ params }) => {
      const { db, services } = ctx
      const moderationService = services.moderation(db)
      const { limit, cursor, invitedBy } = params
      const term = params.term?.trim() ?? ''

      const keyset = new ListKeyset(sql``, sql``)

      if (!term) {
        const results = await services
          .account(db)
          .list({ limit, cursor, includeSoftDeleted: true, invitedBy })
        return {
          encoding: 'application/json',
          body: {
            cursor: keyset.packFromResult(results),
            repos: await moderationService.views.repo(results),
          },
        }
      }

      const results = await services
        .account(db)
        .search({ term, limit, cursor, includeSoftDeleted: true })

      return {
        encoding: 'application/json',
        body: {
          cursor: keyset.packFromResult(results),
          repos: await moderationService.views.repo(results),
        },
      }
    },
  })
}
