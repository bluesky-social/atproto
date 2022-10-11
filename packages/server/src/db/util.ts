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

export const isNotRepostClause = sql<0 | 1>`originator.did == post.creator`

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
