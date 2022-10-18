import { QueryParams } from '@atproto/api/src/types/app/bsky/getUsersTypeahead'
import Database from '../../../db'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'
import {
  cleanTerm,
  getUserSearchQueryPg,
  getUserSearchQuerySqlite,
} from './util/search'

export default function (server: Server) {
  server.app.bsky.getUsersTypeahead(async (params, _input, req, res) => {
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
      name: result.name,
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
    .leftJoin('app_bsky_profile as profile', 'profile.creator', 'user.did')
    .select([
      'user.did as did',
      'user.username as name',
      'profile.displayName as displayName',
    ])
    .execute()
}

const getResultsSqlite: GetResultsFn = async (db, { term, limit }) => {
  return await getUserSearchQuerySqlite(db, { term, limit })
    .leftJoin('app_bsky_profile as profile', 'profile.creator', 'user.did')
    .select([
      'user.did as did',
      'user.username as name',
      'profile.displayName as displayName',
    ])
    .execute()
}

type GetResultsFn = (
  db: Database,
  opts: QueryParams & { limit: number },
) => Promise<{ did: string; name: string; displayName: string | null }[]>
