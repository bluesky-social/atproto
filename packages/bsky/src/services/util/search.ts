import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import Database from '../../db'
import { notSoftDeletedClause, DbRef, AnyQb } from '../../db/util'
import { GenericKeyset, paginate } from '../../db/pagination'

export const getUserSearchQuery = (
  db: Database,
  opts: {
    term: string
    limit: number
    cursor?: string
    includeSoftDeleted?: boolean
  },
) => {
  const { ref } = db.db.dynamic
  const { term, limit, cursor, includeSoftDeleted } = opts
  // Matching user accounts based on handle
  const distanceAccount = distance(term, ref('handle'))
  let accountsQb = getMatchingAccountsQb(db, { term, includeSoftDeleted })
  accountsQb = paginate(accountsQb, {
    limit,
    cursor,
    direction: 'asc',
    keyset: new SearchKeyset(distanceAccount, ref('actor.did')),
  })
  // Matching profiles based on display name
  const distanceProfile = distance(term, ref('displayName'))
  let profilesQb = getMatchingProfilesQb(db, { term, includeSoftDeleted })
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
    term: string
    limit: number
  },
) => {
  const { ref } = db.db.dynamic
  const { term, limit } = opts
  // Matching user accounts based on handle
  const accountsQb = getMatchingAccountsQb(db, { term })
    .orderBy('distance', 'asc')
    .limit(limit)
  // Matching profiles based on display name
  const profilesQb = getMatchingProfilesQb(db, { term })
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
  opts: { term: string; includeSoftDeleted?: boolean },
) => {
  const { ref } = db.db.dynamic
  const { term, includeSoftDeleted } = opts
  const distanceAccount = distance(term, ref('handle'))
  return db.db
    .selectFrom('actor')
    .if(!includeSoftDeleted, (qb) =>
      qb.where(notSoftDeletedClause(ref('actor'))),
    )
    .where('actor.handle', 'is not', null)
    .where(similar(term, ref('handle'))) // Coarse filter engaging trigram index
    .where(distanceAccount, '<', getMatchThreshold(term)) // Refines results from trigram index
    .select(['actor.did as did', distanceAccount.as('distance')])
}

// Matching profiles based on display name
const getMatchingProfilesQb = (
  db: Database,
  opts: { term: string; includeSoftDeleted?: boolean },
) => {
  const { ref } = db.db.dynamic
  const { term, includeSoftDeleted } = opts
  const distanceProfile = distance(term, ref('displayName'))
  return db.db
    .selectFrom('profile')
    .innerJoin('actor', 'actor.did', 'profile.creator')
    .if(!includeSoftDeleted, (qb) =>
      qb.where(notSoftDeletedClause(ref('actor'))),
    )
    .where('actor.handle', 'is not', null)
    .where(similar(term, ref('displayName'))) // Coarse filter engaging trigram index
    .where(distanceProfile, '<', getMatchThreshold(term)) // Refines results from trigram index
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
export const cleanTerm = (term: string) => term.trim().replace(/^@/g, '')

// Uses pg_trgm strict word similarity to check similarity between a search term and a stored value
const distance = (term: string, ref: DbRef) =>
  sql<number>`(${term} <<<-> ${ref})`

// Can utilize trigram index to match on strict word similarity
const similar = (term: string, ref: DbRef) => sql<boolean>`(${term} <<% ${ref})`

const getMatchThreshold = (term: string) => {
  // Performing matching by word using "strict word similarity" operator.
  // The more characters the user gives us, the more we can ratchet down
  // the distance threshold for matching.
  return term.length < 3 ? 0.9 : 0.8
}

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
