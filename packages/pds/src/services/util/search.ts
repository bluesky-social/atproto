import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import Database from '../../db'
import { notSoftDeletedClause, DbRef, AnyQb } from '../../db/util'
import { GenericKeyset, paginate } from '../../db/pagination'

// @TODO utilized in both pds and app-view
export const getUserSearchQueryPg = (
  db: Database,
  opts: {
    term: string
    limit: number
    cursor?: string
    includeSoftDeleted?: boolean
    invitedBy?: string
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
    keyset: new SearchKeyset(distanceAccount, ref('handle')),
  })
  // Matching profiles based on display name
  const distanceProfile = distance(term, ref('displayName'))
  let profilesQb = getMatchingProfilesQb(db, { term, includeSoftDeleted })
  profilesQb = paginate(
    profilesQb.innerJoin('did_handle', 'did_handle.did', 'profile.creator'), // for handle pagination
    {
      limit,
      cursor,
      direction: 'asc',
      keyset: new SearchKeyset(distanceProfile, ref('handle')),
    },
  )
  // Combine and paginate result set
  return paginate(combineAccountsAndProfilesQb(db, accountsQb, profilesQb), {
    limit,
    cursor,
    direction: 'asc',
    keyset: new SearchKeyset(ref('distance'), ref('handle')),
  })
}

// Takes maximal advantage of trigram index at the expense of ability to paginate.
export const getUserSearchQuerySimplePg = (
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
    keyset: new SearchKeyset(ref('distance'), ref('handle')),
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
    .selectFrom('did_handle')
    .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
    .if(!includeSoftDeleted, (qb) =>
      qb.where(notSoftDeletedClause(ref('repo_root'))),
    )
    .where(similar(term, ref('handle'))) // Coarse filter engaging trigram index
    .where(distanceAccount, '<', getMatchThreshold(term)) // Refines results from trigram index
    .select(['did_handle.did as did', distanceAccount.as('distance')])
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
    .innerJoin('repo_root', 'repo_root.did', 'profile.creator')
    .if(!includeSoftDeleted, (qb) =>
      qb.where(notSoftDeletedClause(ref('repo_root'))),
    )
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
    .selectFrom('user_account')
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
    .innerJoin('did_handle', 'did_handle.did', 'results.did')
}

export const getUserSearchQuerySqlite = (
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
    return db.db.selectFrom('did_handle').where(sql`1 = 0`)
  }

  // We'll ensure there's a space before each word in both textForMatch and in safeWords,
  // so that we can reliably match word prefixes using LIKE operator.
  const textForMatch = sql`lower(' ' || ${ref(
    'did_handle.handle',
  )} || ' ' || coalesce(${ref('profile.displayName')}, ''))`

  const keyset = new SearchKeyset(sql``, sql``)
  const unpackedCursor = keyset.unpackCursor(cursor)

  return db.db
    .selectFrom('did_handle')
    .innerJoin('repo_root as _repo_root', '_repo_root.did', 'did_handle.did')
    .if(!includeSoftDeleted, (qb) =>
      qb.where(notSoftDeletedClause(ref('_repo_root'))),
    )
    .where((q) => {
      safeWords.forEach((word) => {
        // Match word prefixes against contents of handle and displayName
        q = q.where(textForMatch, 'like', `% ${word.toLowerCase()}%`)
      })
      return q
    })
    .if(!!unpackedCursor, (qb) =>
      unpackedCursor ? qb.where('handle', '>', unpackedCursor.secondary) : qb,
    )
    .orderBy('handle')
    .limit(limit)
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
