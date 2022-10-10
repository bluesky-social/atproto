import { sql } from 'kysely'

export const userWhereClause = (user: string) => {
  if (user.startsWith('did:')) {
    return sql<boolean>`user.did = ${user}`
  } else {
    return sql<boolean>`user.username = ${user}`
  }
}

export const isNotRepostClause = sql<boolean>`originator.did == post.creator`

export const postOrRepostIndexedAtClause = sql<string>`iif(${isNotRepostClause}, post.indexedAt, repost.indexedAt)`

// datetimes go to/from the database in the format 'YYYY-MM-DD HH:MM:SS'
// whereas ISO datetimes take the format 'YYYY-MM-DDTHH:MM:SSZ', so we convert.

// E.g. 2022-10-08 04:05:22.079 -> 2022-10-08T04:05:22.079Z
export const dateFromDb = (date: string) => {
  if (date.endsWith('Z') && date.includes('T')) {
    return date
  }
  return new Date(date + 'Z').toISOString()
}

// E.g. 2022-10-08T04:05:22.079Z -> 2022-10-08 04:05:22.079
export const dateToDb = (date: string) => {
  if (!date.endsWith('Z') && date.includes(' ')) {
    return date
  }
  return date.replace('T', ' ').replace(/Z$/, '')
}
