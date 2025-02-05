import { ServiceImpl } from '@connectrpc/connect'
import { sql } from 'kysely'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getFollowSuggestions(req) {
    const { actorDid, relativeToDid, cursor, limit } = req
    if (relativeToDid) {
      return getFollowSuggestionsRelativeTo(db, {
        actorDid,
        relativeToDid,
        cursor: cursor || undefined,
        limit: limit || undefined,
      })
    } else {
      return getFollowSuggestionsGlobal(db, {
        actorDid,
        cursor: cursor || undefined,
        limit: limit || undefined,
      })
    }
  },

  async getSuggestedEntities() {
    const entities = await db.db
      .selectFrom('tagged_suggestion')
      .selectAll()
      .execute()
    return {
      entities,
    }
  },
})

const getFollowSuggestionsGlobal = async (
  db: Database,
  input: { actorDid: string; cursor?: string; limit?: number },
) => {
  const alreadyIncluded = parseCursor(input.cursor)
  const suggestions = await db.db
    .selectFrom('suggested_follow')
    .innerJoin('actor', 'actor.did', 'suggested_follow.did')
    .if(alreadyIncluded.length > 0, (qb) =>
      qb.where('suggested_follow.order', 'not in', alreadyIncluded),
    )
    .selectAll()
    .orderBy('suggested_follow.order', 'asc')
    .execute()

  // always include first two
  const firstTwo = suggestions.filter(
    (row) => row.order === 1 || row.order === 2,
  )
  const rest = suggestions.filter((row) => row.order !== 1 && row.order !== 2)
  const limited = firstTwo.concat(shuffle(rest)).slice(0, input.limit)

  // if the result set ends up getting larger, consider using a seed included in the cursor for for the randomized shuffle
  const cursor =
    limited.length > 0
      ? limited
          .map((row) => row.order.toString())
          .concat(alreadyIncluded.map((id) => id.toString()))
          .join(':')
      : undefined

  return {
    dids: limited.map((s) => s.did),
    cursor,
  }
}

const getFollowSuggestionsRelativeTo = async (
  db: Database,
  input: {
    actorDid: string
    relativeToDid: string
    cursor?: string
    limit?: number
  },
) => {
  if (input.cursor) return { dids: [] }
  const limit = input.limit ? Math.min(10, input.limit) : 10
  const actorsViewerFollows = db.db
    .selectFrom('follow')
    .where('creator', '=', input.actorDid)
    .select('subjectDid')
  const mostLikedAccounts = await db.db
    .selectFrom(
      db.db
        .selectFrom('like')
        .where('creator', '=', input.relativeToDid)
        .select(sql`split_part(subject, '/', 3)`.as('subjectDid'))
        .orderBy('sortAt', 'desc')
        .limit(1000) // limit to 1000
        .as('likes'),
    )
    .select('likes.subjectDid as did')
    .select((qb) => qb.fn.count('likes.subjectDid').as('count'))
    .where('likes.subjectDid', 'not in', actorsViewerFollows)
    .where('likes.subjectDid', 'not in', [input.actorDid, input.relativeToDid])
    .groupBy('likes.subjectDid')
    .orderBy('count', 'desc')
    .limit(limit)
    .execute()
  const resultDids = mostLikedAccounts.map((a) => ({ did: a.did })) as {
    did: string
  }[]

  if (resultDids.length < limit) {
    // backfill with popular accounts followed by actor
    const mostPopularAccountsActorFollows = await db.db
      .selectFrom('follow')
      .innerJoin('profile_agg', 'follow.subjectDid', 'profile_agg.did')
      .select('follow.subjectDid as did')
      .where('follow.creator', '=', input.actorDid)
      .where('follow.subjectDid', '!=', input.relativeToDid)
      .where('follow.subjectDid', 'not in', actorsViewerFollows)
      .if(resultDids.length > 0, (qb) =>
        qb.where(
          'subjectDid',
          'not in',
          resultDids.map((a) => a.did),
        ),
      )
      .orderBy('profile_agg.followersCount', 'desc')
      .limit(limit)
      .execute()

    resultDids.push(...mostPopularAccountsActorFollows)
  }

  if (resultDids.length < limit) {
    // backfill with suggested_follow table
    const additional = await db.db
      .selectFrom('suggested_follow')
      .where(
        'did',
        'not in',
        // exclude any we already have
        resultDids
          .map((a) => a.did)
          .concat([input.actorDid, input.relativeToDid]),
      )
      // and aren't already followed by viewer
      .where('did', 'not in', actorsViewerFollows)
      .selectAll()
      .execute()

    resultDids.push(...additional)
  }

  return { dids: resultDids.map((x) => x.did) }
}

const parseCursor = (cursor?: string): number[] => {
  if (!cursor) {
    return []
  }
  try {
    return cursor
      .split(':')
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id))
  } catch {
    return []
  }
}

const shuffle = <T>(arr: T[]): T[] => {
  return arr
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)
}
