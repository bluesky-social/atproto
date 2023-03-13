import { sql } from 'kysely'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  cleanTerm,
  getUserSearchQuery,
  SearchKeyset,
} from '../../../../services/util/search'
import { authVerifier } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.search({
    auth: authVerifier,
    handler: async ({ auth, params }) => {
      const { services, db } = ctx
      let { term, limit } = params
      const { before } = params
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

      const results = await getUserSearchQuery(db, { term, limit, before })
        .select('distance')
        .selectAll('actor')
        .execute()
      const keyset = new SearchKeyset(sql``, sql``)

      return {
        encoding: 'application/json',
        body: {
          cursor: keyset.packFromResult(results),
          users: await services
            .actor(db)
            .views.profileBasic(results, requester),
        },
      }
    },
  })
}
