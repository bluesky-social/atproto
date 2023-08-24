import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { SearchKeyset } from '../../../../services/util/search'
import { sql } from 'kysely'
import { ListKeyset } from '../../../../services/account'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchRepos({
    auth: ctx.roleVerifier,
    handler: async ({ req, params, auth }) => {
      if (ctx.shouldProxyModeration()) {
        // @TODO merge invite details to this list view. could also add
        // support for invitedBy param, which is not supported by appview.
        const { data: result } =
          await ctx.appviewAgent.com.atproto.admin.searchRepos(
            params,
            authPassthru(req),
          )
        return {
          encoding: 'application/json',
          body: result,
        }
      }

      const access = auth.credentials
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
            repos: await moderationService.views.repo(results, {
              includeEmails: access.moderator,
            }),
          },
        }
      }

      const searchField = term.startsWith('did:') ? 'did' : 'handle'

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
          repos: await moderationService.views.repo(results, {
            includeEmails: access.moderator,
          }),
        },
      }
    },
  })
}
