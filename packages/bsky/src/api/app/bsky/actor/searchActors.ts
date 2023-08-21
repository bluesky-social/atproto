import { sql } from 'kysely'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  cleanTerm,
  getUserSearchQuery,
  SearchKeyset,
} from '../../../../services/util/search'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.searchActors({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth, params }) => {
      const { cursor, limit, term: rawTerm } = params
      const requester = auth.credentials.did
      const term = cleanTerm(rawTerm || '')

      const db = ctx.db.getReplica('search')

      const results = term
        ? await getUserSearchQuery(db, { term, limit, cursor })
            .select('distance')
            .selectAll('actor')
            .execute()
        : []
      const keyset = new SearchKeyset(sql``, sql``)

      const actors = await ctx.services
        .actor(db)
        .views.hydrateProfiles(results, requester)
      const filtered = actors.filter(
        (actor) => !actor.viewer?.blocking && !actor.viewer?.blockedBy,
      )

      return {
        encoding: 'application/json',
        body: {
          cursor: keyset.packFromResult(results),
          actors: filtered,
        },
      }
    },
  })
}
