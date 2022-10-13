import { sql } from 'kysely'
import { QueryParams } from '@adxp/api/src/types/app/bsky/getUsersTypeahead'
import Database from '../../../db'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.app.bsky.getUsersTypeahead(async (params, _input, req, res) => {
    let { term, limit } = params
    const { db, auth } = locals.get(res)
    auth.getUserDidOrThrow(req)

    // Remove leading @ in case a username is input that way
    term = term.trim().replace(/^@/g, '')
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
  const { ref } = db.db.dynamic

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
    .distinctOn('did') // Per did, take whichever of account and profile distance is best
    .orderBy('did')
    .orderBy('distance')

  return await db.db
    .selectFrom(resultsQb.as('results'))
    .innerJoin('user', 'user.did', 'results.did')
    .leftJoin('app_bsky_profile as profile', 'profile.creator', 'results.did')
    .orderBy('distance')
    .orderBy('username') // Keep order stable: break ties in distance arbitrarily using username
    .limit(limit)
    .select([
      'distance',
      'user.did as did',
      'user.username as name',
      'profile.displayName as displayName',
    ])
    .execute()
}

const getResultsSqlite: GetResultsFn = async (db, { term, limit }) => {
  const { ref } = db.db.dynamic

  // Take the first three words in the search term. We're going to build a dynamic query
  // based on the number of words, so to keep things predictable just ignore words 4 and
  // beyond. We also remove the special wildcard characters supported by the LIKE operator,
  // since that's where these values are heading.
  const safeWords = term.replace(/[%_]/g, '').split(/\s+/).slice(0, 3)

  // We'll ensured there's a space before each word in both textForMatch and in safeWords,
  // so that we can reliably match word prefixes using LIKE operator.
  const textForMatch = sql`lower(' ' || ${ref(
    'user.username',
  )} || ' ' || coalesce(${ref('profile.displayName')}, ''))`

  return await db.db
    .selectFrom('user')
    .leftJoin('app_bsky_profile as profile', 'profile.creator', 'user.did')
    .where((q) => {
      safeWords.forEach((word) => {
        // Match word prefixes against contents of username and displayName
        q = q.where(textForMatch, 'like', `% ${word.toLowerCase()}%`)
      })
      return q
    })
    .orderBy('user.username')
    .limit(limit)
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
