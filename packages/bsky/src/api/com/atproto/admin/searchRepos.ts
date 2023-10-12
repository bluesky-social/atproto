import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { addAccountInfoToRepoView, getPdsAccountInfos } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchRepos({
    auth: ctx.roleVerifier,
    handler: async ({ params, auth }) => {
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const { limit, cursor } = params
      // prefer new 'q' query param over deprecated 'term'
      const query = params.q ?? params.term

      const { results, cursor: resCursor } = await ctx.services
        .actor(db)
        .getSearchResults({ query, limit, cursor, includeSoftDeleted: true })

      const [partialRepos, actorInfos] = await Promise.all([
        moderationService.views.repo(results),
        getPdsAccountInfos(
          ctx,
          results.map((r) => r.did),
        ),
      ])

      const repos = partialRepos.map((repo) =>
        addAccountInfoToRepoView(
          repo,
          actorInfos[repo.did] ?? null,
          auth.credentials.moderator,
        ),
      )

      return {
        encoding: 'application/json',
        body: {
          cursor: resCursor,
          repos,
        },
      }
    },
  })
}
