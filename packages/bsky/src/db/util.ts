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
    return sql<0 | 1>`"actor"."did" = ${actor}`
  } else {
    return sql<0 | 1>`"actor"."handle" = ${actor}`
  }
}

// Applies to actor or record table
export const notSoftDeletedClause = (alias: DbRef) => {
  return sql`${alias}."takedownId" is null`
}

export const softDeleted = (actorOrRecord: { takedownId: number | null }) => {
  return actorOrRecord.takedownId !== null
}

export const countAll = sql<number>`count(*)`

export const noMatch = sql`1 = 0`

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
