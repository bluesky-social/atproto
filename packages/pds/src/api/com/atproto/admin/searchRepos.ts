import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { SearchKeyset } from '../../../../services/util/search'
import { sql } from 'kysely'
import { ListKeyset } from '../../../../services/account'
import { ensureValidDid } from '@atproto/identifier'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchRepos({
    auth: ctx.moderatorVerifier,
    handler: async ({ params }) => {
      const { db, services } = ctx
      const moderationService = services.moderation(db)
      const { term = '', limit = 50, cursor, invitedBy } = params

      if (!term) {
        const results = await services
          .account(db)
          .list({ limit, cursor, includeSoftDeleted: true, invitedBy })
        const keyset = new ListKeyset(sql``, sql``)

        return {
          encoding: 'application/json',
          body: {
            cursor: keyset.packFromResult(results),
            repos: await moderationService.views.repo(results),
          },
        }
      }

      let searchField: 'did' | 'handle'
      try {
        ensureValidDid(term)
        searchField = 'did'
      } catch (err) {
        searchField = 'handle'
      }

      const results = await services
        .account(db)
        .search({ searchField, term, limit, cursor, includeSoftDeleted: true })
      const keyset = new SearchKeyset(sql``, sql``)

      return {
        encoding: 'application/json',
        body: {
          // For did search, we can only find 1 or no match, cursors can be ignored entirely
          cursor:
            searchField === 'did' ? undefined : keyset.packFromResult(results),
          repos: await moderationService.views.repo(results),
        },
      }
    },
  })
}
