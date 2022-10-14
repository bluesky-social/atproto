import { InvalidRequestError } from '@adxp/xrpc-server'
import { sql } from 'kysely'
import Database from '../../../../db'

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

  const distanceAccount = sql<number>`(${ref('username')} <->>> ${term})`
  const keysetAccount =
    cursor &&
    sql`(${distanceAccount} > ${cursor.distance}) or (${distanceAccount} = ${cursor.distance} and username > ${cursor.name})`
  const accountsQb = db.db
    .selectFrom('user')
    .where(sql`(${distanceAccount} < ${threshold})`)
    .if(!!keysetAccount, (qb) => (keysetAccount ? qb.where(keysetAccount) : qb))
    .select(['user.did as did', distanceAccount.as('distance')])
    .orderBy(distanceAccount)
    .orderBy('username')
    .limit(limit)

  const distanceProfile = sql<number>`(${ref('displayName')} <->>> ${term})`
  const keysetProfile =
    cursor &&
    sql`(${distanceProfile} > ${cursor.distance}) or (${distanceProfile} = ${cursor.distance} and username > ${cursor.name})`
  const profilesQb = db.db
    .selectFrom('app_bsky_profile')
    .innerJoin('user', 'user.did', 'app_bsky_profile.creator')
    .where(sql`(${distanceProfile} < ${threshold})`)
    .if(!!keysetProfile, (qb) => (keysetProfile ? qb.where(keysetProfile) : qb))
    .select(['user.did as did', distanceProfile.as('distance')])
    .orderBy(distanceProfile)
    .orderBy('username')
    .limit(limit)

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

  const keysetAll =
    cursor &&
    sql`(${ref('distance')} > ${cursor.distance}) or (${ref('distance')} = ${
      cursor.distance
    } and username > ${cursor.name})`

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
  const safeWords = term.replace(/[%_]/g, '').split(/\s+/).slice(0, 3)

  // We'll ensured there's a space before each word in both textForMatch and in safeWords,
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
  const result = JSON.parse(before) /// @TODO bourne
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
