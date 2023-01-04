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
    return sql<0 | 1>`"did_handle"."did" = ${actor}`
  } else {
    return sql<0 | 1>`"did_handle"."handle" = ${actor}`
  }
}

export const actorNotSoftDeletedClause = (alias: DbRef = sql`"did_handle"`) => {
  return sql`${alias}."takedownId" is null`
}

export const recordNotSoftDeletedClause = (alias: DbRef = sql`"record"`) => {
  return sql`${alias}."takedownId" is null`
}

export const actorSoftDeleted = (actor: { takedownId: number | null }) => {
  return actor.takedownId !== null
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
