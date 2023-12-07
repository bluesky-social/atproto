import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../../../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getFollowSuggestions(req) {
    const alreadyIncluded = parseCursor(req.cursor)
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
    const limited = firstTwo.concat(shuffle(rest)).slice(0, req.limit)

    // if the result set ends up getting larger, consider using a seed included in the cursor for for the randomized shuffle
    const cursor =
      limited.length > 0
        ? limited
            .map((row) => row.order.toString())
            .concat(alreadyIncluded.map((id) => id.toString()))
            .join(':')
        : undefined

    return {
      dids: suggestions.map((s) => s.did),
      cursor,
    }
  },
})

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
