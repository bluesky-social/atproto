import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import Database from '../../db'
import { notSoftDeletedClause, DbRef } from '../../db/util'
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

  // Performing matching by word using "strict word similarity" operator.
  // The more characters the user gives us, the more we can ratchet down
  // the distance threshold for matching.
  const threshold = term.length < 3 ? 0.9 : 0.8

  // Matching user accounts based on handle
  const distanceAccount = distance(term, ref('handle'))
  let accountsQb = db.db
    .selectFrom('actor')
    .if(!includeSoftDeleted, (qb) =>
      qb.where(notSoftDeletedClause(ref('actor'))),
    )
    .where(similar(term, ref('handle'))) // Coarse filter engaging trigram index
    .where(distanceAccount, '<', threshold) // Refines results from trigram index
    .select(['actor.did as did', distanceAccount.as('distance')])
  accountsQb = paginate(accountsQb, {
    limit,
    cursor,
    direction: 'asc',
    keyset: new SearchKeyset(distanceAccount, ref('handle')),
  })

  // Matching profiles based on display name
  const distanceProfile = distance(term, ref('displayName'))
  let profilesQb = db.db
    .selectFrom('profile')
    .innerJoin('actor', 'actor.did', 'profile.creator')
    .if(!includeSoftDeleted, (qb) =>
      qb.where(notSoftDeletedClause(ref('actor'))),
    )
    .where(similar(term, ref('displayName'))) // Coarse filter engaging trigram index
    .where(distanceProfile, '<', threshold) // Refines results from trigram index
    .select(['actor.did as did', distanceProfile.as('distance')])
  profilesQb = paginate(profilesQb, {
    limit,
    cursor,
    direction: 'asc',
    keyset: new SearchKeyset(distanceProfile, ref('handle')),
  })

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

  // Sort and paginate all user results
  const allQb = db.db
    .selectFrom(resultsQb.as('results'))
    .innerJoin('actor', 'actor.did', 'results.did')
  return paginate(allQb, {
    limit,
    cursor,
    direction: 'asc',
    keyset: new SearchKeyset(ref('distance'), ref('handle')),
  })
}

// Remove leading @ in case a handle is input that way
export const cleanTerm = (term: string) => term.trim().replace(/^@/g, '')

// Uses pg_trgm strict word similarity to check similarity between a search term and a stored value
const distance = (term: string, ref: DbRef) =>
  sql<number>`(${term} <<<-> ${ref})`

// Can utilize trigram index to match on strict word similarity
const similar = (term: string, ref: DbRef) => sql<boolean>`(${term} <<% ${ref})`

type Result = { distance: number; handle: string }
type LabeledResult = { primary: number; secondary: string }
export class SearchKeyset extends GenericKeyset<Result, LabeledResult> {
  labelResult(result: Result) {
    return {
      primary: result.distance,
      secondary: result.handle,
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
