import { sql } from 'kysely'
import AppContext from '../../../../../context'
import Database from '../../../../../db'
import { DidHandle } from '../../../../../db/tables/did-handle'
import { Server } from '../../../../../lexicon'
import * as Method from '../../../../../lexicon/types/app/bsky/actor/searchActors'
import {
  cleanTerm,
  getUserSearchQueryPg,
  getUserSearchQuerySqlite,
  SearchKeyset,
} from '../../../../../services/util/search'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.searchActors({
    auth: ctx.accessVerifier,
    handler: async ({ req, auth, params }) => {
      const requester = auth.credentials.did
      if (ctx.canProxyRead(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.actor.searchActors(
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
      const { cursor } = params

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
        db.dialect === 'pg'
          ? await getResultsPg(db, { term, limit, cursor })
          : await getResultsSqlite(db, { term, limit, cursor })

      const keyset = new SearchKeyset(sql``, sql``)

      const actors = await services.appView
        .actor(db)
        .views.hydrateProfiles(results, requester)

      const filtered = actors.filter(
        (actor) => !actor.viewer?.blocking && !actor.viewer?.blockedBy,
      )

      return {
        encoding: 'application/json',
        body: {
          cursor: keyset.packFromResult(results),
          actors: filtered,
        },
      }
    },
  })
}

const getResultsPg: GetResultsFn = async (db, { term, limit, cursor }) => {
  return await getUserSearchQueryPg(db, { term: term || '', limit, cursor })
    .select('distance')
    .selectAll('did_handle')
    .execute()
}

const getResultsSqlite: GetResultsFn = async (db, { term, limit, cursor }) => {
  return await getUserSearchQuerySqlite(db, { term: term || '', limit, cursor })
    .leftJoin('profile', 'profile.creator', 'did_handle.did')
    .select(sql<number>`0`.as('distance'))
    .selectAll('did_handle')
    .execute()
}

type GetResultsFn = (
  db: Database,
  opts: Method.QueryParams & { limit: number },
) => Promise<(DidHandle & { distance: number })[]>
