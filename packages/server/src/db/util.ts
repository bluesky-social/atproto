import {
  DummyDriver,
  RawBuilder,
  SelectQueryBuilder,
  sql,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from 'kysely'

export const userWhereClause = (user: string) => {
  if (user.startsWith('did:')) {
    return sql<boolean>`user.did = ${user}`
  } else {
    return sql<boolean>`user.username = ${user}`
  }
}

export const isNotRepostClause = sql<boolean>`originator.did == post.creator`

export const postOrRepostIndexedAtClause = sql<string>`iif(${isNotRepostClause}, post.indexedAt, repost.indexedAt)`

export const countClause = sql<number>`count(*)`

export const paginate = <QB extends SelectQueryBuilder<any, any, any>>(
  qb: QB,
  opts: { limit?: number; before?: string; by: RawBuilder },
) => {
  return qb
    .orderBy(opts.by, 'desc')
    .if(opts.limit !== undefined, (q) => q.limit(opts.limit as number))
    .if(opts.before !== undefined, (q) => q.where(opts.by, '<', opts.before))
}

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

export const dummyDialect = {
  createAdapter() {
    return new SqliteAdapter()
  },
  createDriver() {
    return new DummyDriver()
  },
  createIntrospector(db) {
    return new SqliteIntrospector(db)
  },
  createQueryCompiler() {
    return new SqliteQueryCompiler()
  },
}
