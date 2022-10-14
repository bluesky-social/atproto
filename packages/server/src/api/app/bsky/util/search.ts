import { sql } from 'kysely'
import { safeParse } from '@hapi/bourne'
import { InvalidRequestError } from '@adxp/xrpc-server'
import Database from '../../../../db'
import { DbRef } from '../../../../db/util'

export const getUserSearchQueryPg = (
  db: Database,
  opts: { term: string; limit: number; before?: string },
) => {
  const { ref } = db.db.dynamic
  const { term, limit, before } = opts

  // Performing matching by word using "strict word similarity" operator.
  // The more characters the user gives us, the more we can ratchet down
  // the distance threshold for matching.
  const threshold = term.length < 3 ? 0.9 : 0.8
  const cursor = before !== undefined ? unpackCursor(before) : undefined

  // Matching user accounts based on username
  const distanceAccount = distance(term, ref('username'))
  const keysetAccount = keyset(cursor, {
    username: ref('username'),
    distance: distanceAccount,
  })
  const accountsQb = db.db
    .selectFrom('user')
    .where(distanceAccount, '<', threshold)
    .if(!!keysetAccount, (qb) => (keysetAccount ? qb.where(keysetAccount) : qb))
    .select(['user.did as did', distanceAccount.as('distance')])
    .orderBy(distanceAccount)
    .orderBy('username')
    .limit(limit)

  // Matching profiles based on display name
  const distanceProfile = distance(term, ref('displayName'))
  const keysetProfile = keyset(cursor, {
    username: ref('username'),
    distance: distanceProfile,
  })
  const profilesQb = db.db
    .selectFrom('app_bsky_profile')
    .innerJoin('user', 'user.did', 'app_bsky_profile.creator')
    .where(distanceProfile, '<', threshold)
    .if(!!keysetProfile, (qb) => (keysetProfile ? qb.where(keysetProfile) : qb))
    .select(['user.did as did', distanceProfile.as('distance')])
    .orderBy(distanceProfile)
    .orderBy('username')
    .limit(limit)

  // Combine user account and profile results, taking best matches from each
  const emptyQb = db.db
    .selectFrom('user')
    .where(sql`1 = 0`)
    .select([sql.literal('').as('did'), sql<number>`0`.as('distance')])
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

  // Sort and paginate all user results
  const keysetAll = keyset(cursor, {
    username: ref('username'),
    distance: ref('distance'),
  })
  return db.db
    .selectFrom(resultsQb.as('results'))
    .innerJoin('user', 'user.did', 'results.did')
    .if(!!keysetAll, (qb) => (keysetAll ? qb.where(keysetAll) : qb))
    .orderBy('distance')
    .orderBy('username') // Keep order stable: break ties in distance arbitrarily using username
    .limit(limit)
}

export const getUserSearchQuerySqlite = (
  db: Database,
  opts: { term: string; limit: number; before?: string },
) => {
  const { ref } = db.db.dynamic
  const { term, limit, before } = opts

  // Take the first three words in the search term. We're going to build a dynamic query
  // based on the number of words, so to keep things predictable just ignore words 4 and
  // beyond. We also remove the special wildcard characters supported by the LIKE operator,
  // since that's where these values are heading.
  const safeWords = term
    .replace(/[%_]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)

  if (!safeWords.length) {
    // Return no results. This could happen with weird input like ' % _ '.
    return db.db.selectFrom('user').where(sql`1 = 0`)
  }

  // We'll ensure there's a space before each word in both textForMatch and in safeWords,
  // so that we can reliably match word prefixes using LIKE operator.
  const textForMatch = sql`lower(' ' || ${ref(
    'user.username',
  )} || ' ' || coalesce(${ref('profile.displayName')}, ''))`

  const cursor = before !== undefined ? unpackCursor(before) : undefined

  return db.db
    .selectFrom('user')
    .where((q) => {
      safeWords.forEach((word) => {
        // Match word prefixes against contents of username and displayName
        q = q.where(textForMatch, 'like', `% ${word.toLowerCase()}%`)
      })
      return q
    })
    .if(!!cursor, (qb) =>
      cursor ? qb.where('username', '>', cursor.name) : qb,
    )
    .orderBy('username')
    .limit(limit)
}

// E.g. { distance: .94827, name: 'pfrazee' } -> '[0.94827,"pfrazee"]'
export const packCursor = (row: { distance: number; name: string }): string => {
  const { distance, name } = row
  return JSON.stringify([distance, name])
}

export const unpackCursor = (
  before: string,
): { distance: number; name: string } => {
  const result = safeParse(before)
  if (!Array.isArray(result)) {
    throw new InvalidRequestError('Malformed cursor')
  }
  const [distance, name, ...others] = result
  if (typeof distance !== 'number' || !name || others.length > 0) {
    throw new InvalidRequestError('Malformed cursor')
  }
  return {
    name,
    distance,
  }
}

// Remove leading @ in case a username is input that way
export const cleanTerm = (term: string) => term.trim().replace(/^@/g, '')

// Uses pg_trgm strict word similarity to check similarity between a search term and a stored value
const distance = (term: string, ref: DbRef) =>
  sql<number>`(${term} <<<-> ${ref})`

// Keyset condition for a cursor
const keyset = (cursor, refs: { username: DbRef; distance: DbRef }) => {
  if (cursor === undefined) return undefined
  return sql`(${refs.distance} > ${cursor.distance}) or (${refs.distance} = ${cursor.distance} and ${refs.username} > ${cursor.name})`
}
