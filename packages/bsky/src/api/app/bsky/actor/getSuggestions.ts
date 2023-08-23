import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getSuggestions({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { limit, cursor } = params
      const viewer = auth.credentials.did

      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const graphService = ctx.services.graph(db)

      const { ref } = db.db.dynamic

      let suggestionsQb = db.db
        .selectFrom('suggested_follow')
        .innerJoin('actor', 'actor.did', 'suggested_follow.did')
        .innerJoin('profile_agg', 'profile_agg.did', 'actor.did')
        .where(notSoftDeletedClause(ref('actor')))
        .where('suggested_follow.did', '!=', viewer ?? '')
        .whereNotExists((qb) =>
          qb
            .selectFrom('follow')
            .selectAll()
            .where('creator', '=', viewer ?? '')
            .whereRef('subjectDid', '=', ref('actor.did')),
        )
        .whereNotExists(graphService.blockQb(viewer, [ref('actor.did')]))
        .selectAll()
        .select('profile_agg.postsCount as postsCount')
        .limit(limit)
        .orderBy('suggested_follow.order', 'asc')

      if (cursor) {
        const cursorRow = await db.db
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
          actors: await actorService.views.hydrateProfiles(
            suggestionsRes,
            viewer,
          ),
        },
      }
    },
  })
}
