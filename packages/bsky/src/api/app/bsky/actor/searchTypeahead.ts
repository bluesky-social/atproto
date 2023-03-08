import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  cleanTerm,
  getUserSearchQueryPg,
} from '../../../../services/util/search'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.searchTypeahead({
    auth: ctx.accessVerifier,
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

      const results = await getResultsPg(ctx.db, { term, limit })

      return {
        encoding: 'application/json',
        body: {
          users: await services.appView
            .actor(db)
            .views.actorWithInfo(results, requester),
        },
      }
    },
  })
}

const getResultsPg = async (db, { term, limit }) => {
  return await getUserSearchQueryPg(db, { term: term || '', limit })
    .leftJoin('profile', 'profile.creator', 'did_handle.did')
    .selectAll('did_handle')
    .execute()
}
