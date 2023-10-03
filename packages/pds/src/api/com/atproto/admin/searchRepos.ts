import { sql } from 'kysely'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { ListKeyset } from '../../../../services/account'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchRepos({
    auth: ctx.roleVerifier,
    handler: async ({ req, params, auth }) => {
      if (ctx.cfg.bskyAppView.proxyModeration) {
        // @TODO merge invite details to this list view. could also add
        // support for invitedBy param, which is not supported by appview.
        const { data: result } =
          await ctx.appViewAgent.com.atproto.admin.searchRepos(
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
      const { limit, cursor, invitedBy } = params
      const query = params.q?.trim() ?? params.term?.trim() ?? ''

      const keyset = new ListKeyset(sql``, sql``)

      if (!query) {
        const results = await services
          .account(db)
          .list({ limit, cursor, includeSoftDeleted: true, invitedBy })
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

      const results = await services
        .account(db)
        .search({ query, limit, cursor, includeSoftDeleted: true })

      return {
        encoding: 'application/json',
        body: {
          // For did search, we can only find 1 or no match, cursors can be ignored entirely
          cursor: query.startsWith('did:')
            ? undefined
            : keyset.packFromResult(results),
          repos: await moderationService.views.repo(results, {
            includeEmails: access.moderator,
          }),
        },
      }
    },
  })
}
