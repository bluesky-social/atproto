import { sql } from 'kysely'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  cleanTerm,
  getUserSearchQueryPg,
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

      const results = await getResultsPg(db, { term, limit, before })
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

const getResultsPg = async (db, { term, limit, before }) => {
  return await getUserSearchQueryPg(db, { term: term || '', limit, before })
    .leftJoin('profile', 'profile.creator', 'did_handle.did')
    .select('distance')
    .selectAll('did_handle')
    .execute()
}
