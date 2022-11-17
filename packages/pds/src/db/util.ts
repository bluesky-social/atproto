import {
  DummyDriver,
  DynamicModule,
  RawBuilder,
  SelectQueryBuilder,
  sql,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from 'kysely'

export const actorWhereClause = (actor: string) => {
  if (actor.startsWith('did:')) {
    return sql<0 | 1>`"did_handle"."did" = ${actor}`
  } else {
    return sql<0 | 1>`"did_handle"."handle" = ${actor}`
  }
}

export const countAll = sql<number>`count(*)`

export const paginate = <QB extends SelectQueryBuilder<any, any, any>>(
  qb: QB,
  opts: {
    limit?: number
    before?: string
    by: DbRef
    secondaryOrder?: DbRef
  },
) => {
  return qb
    .orderBy(opts.by, 'desc')
    .if(opts.secondaryOrder !== undefined, (q) =>
      q.orderBy(opts.secondaryOrder as DbRef, 'desc'),
    )
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

export type DbRef = RawBuilder | ReturnType<DynamicModule['ref']>
