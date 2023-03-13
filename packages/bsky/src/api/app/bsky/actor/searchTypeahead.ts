import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { cleanTerm, getUserSearchQuery } from '../../../../services/util/search'
import { authVerifier } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.searchTypeahead({
    auth: authVerifier,
    handler: async ({ params, auth }) => {
      const { services, db } = ctx
      let { term, limit } = params
      const requester = auth.credentials.did

      term = cleanTerm(term || '')
      limit = Math.min(limit ?? 25, 100)

      if (!term) {
        return {
          encoding: 'application/json',
          body: {
            users: [],
          },
        }
      }

      const results = await getUserSearchQuery(db, { term, limit })
        .selectAll('actor')
        .execute()

      return {
        encoding: 'application/json',
        body: {
          users: await services
            .actor(db)
            .views.actorWithInfo(results, requester),
        },
      }
    },
  })
}
