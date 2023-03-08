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

// Applies to repo_root or record table
export const notSoftDeletedClause = (alias: DbRef) => {
  return sql`${alias}."takedownId" is null`
}

export const softDeleted = (repoOrRecord: { takedownId: number | null }) => {
  return repoOrRecord.takedownId !== null
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
