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
      let { limit, term: rawTerm, q: rawQ } = params
      const requester = auth.credentials.did

      // prefer new 'q' query param over deprecated 'term'
      if (rawQ) {
        rawTerm = rawQ
      }

      const term = cleanTerm(rawTerm || '')

      const db = ctx.db.getReplica('search')

      const results = term
        ? await getUserSearchQuerySimple(db, { term, limit })
            .selectAll('actor')
            .execute()
        : []

      const actors = await ctx.services
        .actor(db)
        .views.profilesBasic(results, requester, { omitLabels: true })

      const SKIP = []
      const filtered = results.flatMap((res) => {
        const actor = actors[res.did]
        if (actor.viewer?.blocking || actor.viewer?.blockedBy) return SKIP
        return actor
      })

      return {
        encoding: 'application/json',
        body: {
          actors: filtered,
        },
      }
    },
  })
}
