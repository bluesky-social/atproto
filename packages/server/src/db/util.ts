import {
  DummyDriver,
  DynamicModule,
  ExpressionBuilder,
  RawBuilder,
  SelectQueryBuilder,
  sql,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from 'kysely'

export const userWhereClause = (user: string) => {
  if (user.startsWith('did:')) {
    return sql<0 | 1>`"user"."did" = ${user}`
  } else {
    return sql<0 | 1>`"user"."username" = ${user}`
  }
}

export const countAll = sql<number>`count(*)`

export const paginate = <QB extends SelectQueryBuilder<any, any, any>>(
  qb: QB,
  opts: {
    limit?: number
    before?: string
    by: DbRef
  },
) => {
  return qb
    .orderBy(opts.by, 'desc')
    .if(opts.limit !== undefined, (q) => q.limit(opts.limit as number))
    .if(opts.before !== undefined, (q) => q.where(opts.by, '<', opts.before))
}

// Useful to select values in a conditional insert
export const selectValues = <EB extends ExpressionBuilder<any, any>>(
  eb: EB,
  vals: unknown[],
) => {
  return eb.selectFrom(sql`(values (${sql.join(vals)}))`.as('vals')).selectAll()
}

export const keys = <O extends { [s: string]: unknown }>(obj: O) => {
  return Object.keys(obj) as (keyof O)[]
}

export const vals = <O extends { [s: string]: unknown }>(obj: O) => {
  return Object.values(obj)
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
