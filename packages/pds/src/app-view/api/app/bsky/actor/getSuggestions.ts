import AppContext from '../../../../../context'
import { notSoftDeletedClause } from '../../../../../db/util'
import { Server } from '../../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getSuggestions({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { limit, cursor } = params
      const requester = auth.credentials.did

      const db = ctx.db.db
      const { services } = ctx
      const { ref } = db.dynamic

      const graphService = ctx.services.appView.graph(ctx.db)

      let suggestionsQb = db
        .selectFrom('suggested_follow')
        .innerJoin('did_handle', 'suggested_follow.did', 'did_handle.did')
        .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
        .innerJoin('profile_agg', 'profile_agg.did', 'did_handle.did')
        .where(notSoftDeletedClause(ref('repo_root')))
        .where('did_handle.did', '!=', requester)
        .whereNotExists((qb) =>
          qb
            .selectFrom('follow')
            .selectAll()
            .where('creator', '=', requester)
            .whereRef('subjectDid', '=', ref('did_handle.did')),
        )
        .whereNotExists(
          graphService.blockQb(requester, [ref('did_handle.did')]),
        )
        .selectAll('did_handle')
        .select('profile_agg.postsCount as postsCount')
        .limit(limit)
        .orderBy('suggested_follow.order', 'asc')

      if (cursor) {
        const cursorRow = await db
          .selectFrom('suggested_follow')
          .where('did', '=', cursor)
          .selectAll()
          .executeTakeFirst()
        if (cursorRow) {
          suggestionsQb = suggestionsQb.where(
            'suggested_follow.order',
            '>',
            cursorRow.order,
          )
        }
      }

      const suggestionsRes = await suggestionsQb.execute()

      return {
        encoding: 'application/json',
        body: {
          cursor: suggestionsRes.at(-1)?.did,
          actors: await services.appView
            .actor(ctx.db)
            .views.profile(suggestionsRes, requester),
        },
      }
    },
  })
}
