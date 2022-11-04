import Database from '../../../../db'
import { Server } from '../../../../lexicon'
import * as Method from '../../../../lexicon/types/app/bsky/actor/search'
import * as locals from '../../../../locals'
import {
  cleanTerm,
  getUserSearchQueryPg,
  getUserSearchQuerySqlite,
} from '../util/search'

export default function (server: Server) {
  server.app.bsky.actor.searchTypeahead(async (params, _input, req, res) => {
    let { term, limit } = params
    const { db, auth } = locals.get(res)
    auth.getUserDidOrThrow(req)

    term = cleanTerm(term)
    limit = Math.min(limit ?? 25, 100)

    if (!term) {
      return {
        encoding: 'application/json',
        body: {
          users: [],
        },
      }
    }

    const results =
      db.dialect === 'pg'
        ? await getResultsPg(db, { term, limit })
        : await getResultsSqlite(db, { term, limit })

    const users = results.map((result) => ({
      did: result.did,
      handle: result.handle,
      displayName: result.displayName ?? undefined,
    }))

    return {
      encoding: 'application/json',
      body: {
        users,
      },
    }
  })
}

const getResultsPg: GetResultsFn = async (db, { term, limit }) => {
  return await getUserSearchQueryPg(db, { term, limit })
    .leftJoin('app_bsky_profile as profile', 'profile.creator', 'user_did.did')
    .select([
      'user_did.did as did',
      'user_did.handle as handle',
      'profile.displayName as displayName',
    ])
    .execute()
}

const getResultsSqlite: GetResultsFn = async (db, { term, limit }) => {
  return await getUserSearchQuerySqlite(db, { term, limit })
    .leftJoin('app_bsky_profile as profile', 'profile.creator', 'user_did.did')
    .select([
      'user_did.did as did',
      'user_did.handle as handle',
      'profile.displayName as displayName',
    ])
    .execute()
}

type GetResultsFn = (
  db: Database,
  opts: Method.QueryParams & { limit: number },
) => Promise<{ did: string; handle: string; displayName: string | null }[]>
