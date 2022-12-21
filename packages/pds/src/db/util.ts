import {
  DummyDriver,
  DynamicModule,
  RawBuilder,
  sql,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from 'kysely'

export const actorWhereClause = (actor: string) => {
  if (actor.startsWith('did:')) {
    return sql<
      0 | 1
    >`("did_handle"."did" = ${actor} and "did_handle"."takedownId" is null)`
  } else {
    return sql<
      0 | 1
    >`("did_handle"."handle" = ${actor} and "did_handle"."takedownId" is null)`
  }
}

export const countAll = sql<number>`count(*)`

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
