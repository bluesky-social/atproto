import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { cleanTerm, getUserSearchQuery } from '../../../../services/util/search'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.searchActorsTypeahead({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { services, db } = ctx
      const { limit, term: rawTerm } = params
      const requester = auth.credentials.did
      const term = cleanTerm(rawTerm || '')

      const results = term
        ? await getUserSearchQuery(db, { term, limit })
            .selectAll('actor')
            .execute()
        : []

      const actors = await services
        .actor(db)
        .views.profileBasic(results, requester)

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
