import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { cleanTerm, getUserSearchQuery } from '../../../../services/util/search'
import { authOptionalVerifier } from '../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.searchActorsTypeahead({
    auth: authOptionalVerifier,
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

      return {
        encoding: 'application/json',
        body: {
          actors: await services
            .actor(db)
            .views.profileBasic(results, requester),
        },
      }
    },
  })
}
