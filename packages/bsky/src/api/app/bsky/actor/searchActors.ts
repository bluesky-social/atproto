import { sql } from 'kysely'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  cleanTerm,
  getUserSearchQuery,
  SearchKeyset,
} from '../../../../services/util/search'
import { authOptionalVerifier } from '../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.searchActors({
    auth: authOptionalVerifier,
    handler: async ({ auth, params }) => {
      const { services, db } = ctx
      const { cursor, limit, term: rawTerm } = params
      const requester = auth.credentials.did
      const term = cleanTerm(rawTerm || '')

      const results = term
        ? await getUserSearchQuery(db, { term, limit, cursor })
            .select('distance')
            .selectAll('actor')
            .execute()
        : []
      const keyset = new SearchKeyset(sql``, sql``)

      return {
        encoding: 'application/json',
        body: {
          cursor: keyset.packFromResult(results),
          actors: await services.actor(db).views.profile(results, requester),
        },
      }
    },
  })
}
