import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Database } from '../../db'
import { notSoftDeletedClause, DbRef, AnyQb } from '../../db/util'
import { GenericKeyset, paginate } from '../../db/pagination'

export const getUserSearchQuery = (
  db: Database,
  opts: {
    query: string
    limit: number
    cursor?: string
    includeSoftDeleted?: boolean
  },
) => {
  const { ref } = db.db.dynamic
  const { query, limit, cursor, includeSoftDeleted } = opts
  // Matching user accounts based on handle
  const distanceAccount = distance(query, ref('handle'))
  let accountsQb = getMatchingAccountsQb(db, { query, includeSoftDeleted })
  accountsQb = paginate(accountsQb, {
    limit,
    cursor,
    direction: 'asc',
    keyset: new SearchKeyset(distanceAccount, ref('actor.did')),
  })
  // Matching profiles based on display name
  const distanceProfile = distance(query, ref('displayName'))
  let profilesQb = getMatchingProfilesQb(db, { query, includeSoftDeleted })
  profilesQb = paginate(profilesQb, {
    limit,
    cursor,
    direction: 'asc',
    keyset: new SearchKeyset(distanceProfile, ref('actor.did')),
  })
  // Combine and paginate result set
  return paginate(combineAccountsAndProfilesQb(db, accountsQb, profilesQb), {
    limit,
    cursor,
    direction: 'asc',
    keyset: new SearchKeyset(ref('distance'), ref('actor.did')),
  })
}

// Takes maximal advantage of trigram index at the expense of ability to paginate.
export const getUserSearchQuerySimple = (
  db: Database,
  opts: {
    query: string
    limit: number
  },
) => {
  const { ref } = db.db.dynamic
  const { query, limit } = opts
  // Matching user accounts based on handle
  const accountsQb = getMatchingAccountsQb(db, { query })
    .orderBy('distance', 'asc')
    .limit(limit)
  // Matching profiles based on display name
  const profilesQb = getMatchingProfilesQb(db, { query })
    .orderBy('distance', 'asc')
    .limit(limit)
  // Combine and paginate result set
  return paginate(combineAccountsAndProfilesQb(db, accountsQb, profilesQb), {
    limit,
    direction: 'asc',
    keyset: new SearchKeyset(ref('distance'), ref('actor.did')),
  })
}

// Matching user accounts based on handle
const getMatchingAccountsQb = (
  db: Database,
  opts: { query: string; includeSoftDeleted?: boolean },
) => {
  const { ref } = db.db.dynamic
  const { query, includeSoftDeleted } = opts
  const distanceAccount = distance(query, ref('handle'))
  return db.db
    .selectFrom('actor')
    .if(!includeSoftDeleted, (qb) =>
      qb.where(notSoftDeletedClause(ref('actor'))),
    )
    .where('actor.handle', 'is not', null)
    .where(similar(query, ref('handle'))) // Coarse filter engaging trigram index
    .select(['actor.did as did', distanceAccount.as('distance')])
}

// Matching profiles based on display name
const getMatchingProfilesQb = (
  db: Database,
  opts: { query: string; includeSoftDeleted?: boolean },
) => {
  const { ref } = db.db.dynamic
  const { query, includeSoftDeleted } = opts
  const distanceProfile = distance(query, ref('displayName'))
  return db.db
    .selectFrom('profile')
    .innerJoin('actor', 'actor.did', 'profile.creator')
    .if(!includeSoftDeleted, (qb) =>
      qb.where(notSoftDeletedClause(ref('actor'))),
    )
    .where('actor.handle', 'is not', null)
    .where(similar(query, ref('displayName'))) // Coarse filter engaging trigram index
    .select(['profile.creator as did', distanceProfile.as('distance')])
}

// Combine profile and account result sets
const combineAccountsAndProfilesQb = (
  db: Database,
  accountsQb: AnyQb,
  profilesQb: AnyQb,
) => {
  // Combine user account and profile results, taking best matches from each
  const emptyQb = db.db
    .selectFrom('actor')
    .where(sql`1 = 0`)
    .select([sql.literal('').as('did'), sql<number>`0`.as('distance')])
  const resultsQb = db.db
    .selectFrom(
      emptyQb
        .unionAll(sql`${accountsQb}`) // The sql`` is adding parens
        .unionAll(sql`${profilesQb}`)
        .as('accounts_and_profiles'),
    )
    .selectAll()
    .distinctOn('did') // Per did, take whichever of account and profile distance is best
    .orderBy('did')
    .orderBy('distance')
  return db.db
    .selectFrom(resultsQb.as('results'))
    .innerJoin('actor', 'actor.did', 'results.did')
}

// Remove leading @ in case a handle is input that way
export const cleanQuery = (query: string) => query.trim().replace(/^@/g, '')

// Uses pg_trgm strict word similarity to check similarity between a search query and a stored value
const distance = (query: string, ref: DbRef) =>
  sql<number>`(${query} <<-> ${ref})`

// Can utilize trigram index to match on strict word similarity.
// The word_similarity_threshold is set to .4 (i.e. distance < .6) in db/index.ts.
const similar = (query: string, ref: DbRef) =>
  sql<boolean>`(${query} <% ${ref})`

type Result = { distance: number; did: string }
type LabeledResult = { primary: number; secondary: string }
export class SearchKeyset extends GenericKeyset<Result, LabeledResult> {
  labelResult(result: Result) {
    return {
      primary: result.distance,
      secondary: result.did,
    }
  }
  labeledResultToCursor(labeled: LabeledResult) {
    return {
      primary: labeled.primary.toString().replace('0.', '.'),
      secondary: labeled.secondary,
    }
  }
  cursorToLabeledResult(cursor: { primary: string; secondary: string }) {
    const distance = parseFloat(cursor.primary)
    if (isNaN(distance)) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary: distance,
      secondary: cursor.secondary,
    }
  }
}
