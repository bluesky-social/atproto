import AppContext from '../../../../../context'
import Database from '../../../../../db'
import { Server } from '../../../../../lexicon'
import * as Method from '../../../../../lexicon/types/app/bsky/actor/searchActorsTypeahead'
import {
  cleanTerm,
  getUserSearchQuerySimplePg,
  getUserSearchQuerySqlite,
} from '../../../../../services/util/search'
import { DidHandle } from '../../../../../db/tables/did-handle'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.searchActorsTypeahead({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      if (ctx.canProxy(req)) {
        const res =
          await ctx.appviewAgent.api.app.bsky.actor.searchActorsTypeahead(
            params,
            await ctx.serviceAuthHeaders(requester),
          )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const { services, db } = ctx
      let { term, limit } = params

      term = cleanTerm(term || '')
      limit = Math.min(limit ?? 25, 100)

      if (!term) {
        return {
          encoding: 'application/json',
          body: {
            actors: [],
          },
        }
      }

      const results =
        ctx.db.dialect === 'pg'
          ? await getResultsPg(ctx.db, { term, limit })
          : await getResultsSqlite(ctx.db, { term, limit })

      const actors = await services.appView
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

const getResultsPg: GetResultsFn = async (db, { term, limit }) => {
  return await getUserSearchQuerySimplePg(db, { term: term || '', limit })
    .selectAll('did_handle')
    .execute()
}

const getResultsSqlite: GetResultsFn = async (db, { term, limit }) => {
  return await getUserSearchQuerySqlite(db, { term: term || '', limit })
    .leftJoin('profile', 'profile.creator', 'did_handle.did')
    .selectAll('did_handle')
    .execute()
}

type GetResultsFn = (
  db: Database,
  opts: Method.QueryParams & { limit: number },
) => Promise<DidHandle[]>
