import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import Database from '../../db'
import { notSoftDeletedClause, DbRef } from '../../db/util'
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
  const accountsQb = getMatchingAccountsQb(db, { term, includeSoftDeleted })
  return paginate(accountsQb, {
    limit,
    cursor,
    direction: 'asc',
    keyset: new SearchKeyset(distanceAccount, ref('handle')),
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
    .select(['did_handle.did as did', distanceAccount.as('distance')])
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
    return db.db
      .selectFrom('did_handle')
      .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
      .where(sql`1 = 0`)
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
    .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
    .if(!includeSoftDeleted, (qb) =>
      qb.where(notSoftDeletedClause(ref('repo_root'))),
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
  sql<number>`(${term} <<-> ${ref})`

// Can utilize trigram index to match on strict word similarity.
// The word_similarity_threshold is set to .4 (i.e. distance < .6) in db/index.ts.
const similar = (term: string, ref: DbRef) => sql<boolean>`(${term} <% ${ref})`

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
