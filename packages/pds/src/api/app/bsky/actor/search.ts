import { sql } from 'kysely'
import Database from '../../../../db'
import { Server } from '../../../../lexicon'
import * as Method from '../../../../lexicon/types/app/bsky/actor/search'
import * as locals from '../../../../locals'
import {
  cleanTerm,
  getUserSearchQueryPg,
  getUserSearchQuerySqlite,
  packCursor,
} from '../util/search'

export default function (server: Server) {
  server.app.bsky.actor.search(async (params, _input, req, res) => {
    let { term, limit } = params
    const { before } = params
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
        ? await getResultsPg(db, { term, limit, before })
        : await getResultsSqlite(db, { term, limit, before })

    const users = results.map((result) => ({
      did: result.did,
      handle: result.handle,
      displayName: result.displayName ?? undefined,
      description: result.description ?? undefined,
      indexedAt: result.indexedAt ?? undefined,
    }))

    const lastResult = results.at(-1)

    return {
      encoding: 'application/json',
      body: {
        users,
        cursor: lastResult && packCursor(lastResult),
      },
    }
  })
}

const getResultsPg: GetResultsFn = async (db, { term, limit, before }) => {
  return await getUserSearchQueryPg(db, { term, limit, before })
    .leftJoin('app_bsky_profile as profile', 'profile.creator', 'user_did.did')
    .select([
      'distance',
      'user_did.did as did',
      'user_did.handle as handle',
      'profile.displayName as displayName',
      'profile.description as description',
      'profile.indexedAt as indexedAt',
    ])
    .execute()
}

const getResultsSqlite: GetResultsFn = async (db, { term, limit, before }) => {
  return await getUserSearchQuerySqlite(db, { term, limit, before })
    .leftJoin('app_bsky_profile as profile', 'profile.creator', 'user_did.did')
    .select([
      sql<number>`0`.as('distance'),
      'user_did.did as did',
      'user_did.handle as handle',
      'profile.displayName as displayName',
      'profile.description as description',
      'profile.indexedAt as indexedAt',
    ])
    .execute()
}

type GetResultsFn = (
  db: Database,
  opts: Method.QueryParams & { limit: number },
) => Promise<
  {
    did: string
    handle: string
    displayName: string | null
    description: string | null
    distance: number
    indexedAt: string | null
  }[]
>
