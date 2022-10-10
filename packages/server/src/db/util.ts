import { sql } from 'kysely'
import { EntityTarget, SelectQueryBuilder } from 'typeorm'

export const userWhereClause = (user: string): string => {
  if (user.startsWith('did:')) {
    return 'user.did = :user'
  } else {
    return 'user.username = :user'
  }
}

export const isNotRepostClause = sql<boolean>`originator.did == post.creator`

export const postOrRepostIndexedAtClause = sql<string>`iif(${isNotRepostClause}, post.indexedAt, repost.indexedAt)`

type Subquery = (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>

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

export const countSubquery = (
  table: EntityTarget<any>,
  subject: string,
): Subquery => {
  return (subquery: SelectQueryBuilder<any>) => {
    return subquery
      .select([`table.${subject} AS subject`, 'COUNT(table.uri) as count'])
      .from(table, 'table')
      .groupBy(`table.${subject}`)
  }
}

export const existsByCreatorSubquery = (
  table: EntityTarget<any>,
  subject: string,
  creator: string,
): Subquery => {
  return (subquery: SelectQueryBuilder<any>) => {
    return subquery
      .select([`table.${subject} AS subject`, 'COUNT(table.uri) as doesExist'])
      .from(table, 'table')
      .where('table.creator = :creator', { creator })
  }
}
