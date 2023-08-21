import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  cleanTerm,
  getUserSearchQuerySimple,
} from '../../../../services/util/search'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.searchActorsTypeahead({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { limit, term: rawTerm } = params
      const requester = auth.credentials.did
      const term = cleanTerm(rawTerm || '')

      const db = ctx.db.getReplica('search')

      const results = term
        ? await getUserSearchQuerySimple(db, { term, limit })
            .selectAll('actor')
            .execute()
        : []

      const actors = await ctx.services
        .actor(db)
        .views.hydrateProfilesBasic(results, requester)

      const filtered = actors.filter(
        (actor) => !actor.viewer?.blocking && !actor.viewer?.blockedBy,
      )

      return {
        encoding: 'application/json',
        body: {
          actors: filtered,
        },
      }
    },
  })
}
