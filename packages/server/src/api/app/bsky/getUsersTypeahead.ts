import { QueryParams } from '@adxp/api/src/types/app/bsky/getUsersTypeahead'
import { sql } from 'kysely'
import Database from '../../../db'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.app.bsky.getUsersTypeahead(async (params, _input, req, res) => {
    let { term, limit } = params
    const { db, auth } = locals.get(res)
    auth.getUserDidOrThrow(req)

    term = term.trim()
    limit = Math.min(limit ?? 25, 100)

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
  const { ref } = db.db.dynamic

  if (!term) {
    return []
  }

  // Performing matching by word using "strict word similarity" operator.
  // The more characters the user gives us, the more we can ratchet down
  // the distance threshold for matching.
  const threshold = term.length < 3 ? 0.9 : 0.8

  const distanceAccount = sql<number>`(${ref('username')} <->>> ${term})`
  const accountsQb = db.db
    .selectFrom('user')
    .where(sql`(${distanceAccount} < ${threshold})`)
    .select(['user.did as did', distanceAccount.as('distance')])
    .orderBy(distanceAccount)
    .limit(limit)

  const distanceProfile = sql<number>`(${ref('displayName')} <->>> ${term})`
  const profilesQb = db.db
    .selectFrom('app_bsky_profile')
    .where(sql`(${distanceProfile} < ${threshold})`)
    .select(['app_bsky_profile.creator as did', distanceProfile.as('distance')])
    .orderBy(distanceProfile)
    .limit(limit)

  const emptyQb = db.db
    .selectFrom('user')
    .where(sql`1 = 0`)
    .select([sql.literal('').as('did'), sql.literal(1).as('distance')])

  const resultsQb = db.db
    .selectFrom(
      emptyQb
        .union(sql`${accountsQb}`) // The sql`` is adding parens
        .union(sql`${profilesQb}`)
        .as('accounts_and_profiles'),
    )
    .selectAll()
    .distinctOn('did') // Per did, take whichever of account and profile score is best
    .orderBy('did')
    .orderBy('distance')

  return await db.db
    .selectFrom(resultsQb.as('results'))
    .innerJoin('user', 'user.did', 'results.did')
    .leftJoin('app_bsky_profile as profile', 'profile.creator', 'results.did')
    .orderBy('distance')
    .orderBy('did') // Keep order stable: break ties in distance arbitrarily using did
    .limit(limit)
    .select([
      'distance',
      'user.did as did',
      'user.username as name',
      'profile.displayName as displayName',
    ])
    .execute()
}

const getResultsSqlite: GetResultsFn = async (db, opts) => {
  throw new Error('Search not yet implemented for sqlite') // @TODO
}

type GetResultsFn = (
  db: Database,
  opts: QueryParams & { limit: number },
) => Promise<{ did: string; name: string; displayName: string | null }[]>
