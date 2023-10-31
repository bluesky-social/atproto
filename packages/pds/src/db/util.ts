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
import DatabaseSchema from './database-schema'

export const actorWhereClause = (actor: string) => {
  if (actor.startsWith('did:')) {
    return sql<0 | 1>`"did_handle"."did" = ${actor}`
  } else {
    return sql<0 | 1>`"did_handle"."handle" = ${actor}`
  }
}

// Applies to repo_root or record table
export const notSoftDeletedClause = (alias: DbRef) => {
  return sql`${alias}."takedownRef" is null`
}

export const softDeleted = (repoOrRecord: { takedownRef: string | null }) => {
  return repoOrRecord.takedownRef !== null
}

export const countAll = sql<number>`count(*)`

// For use with doUpdateSet()
export const excluded = <T>(db: DatabaseSchema, col) => {
  return sql<T>`${db.dynamic.ref(`excluded.${col}`)}`
}

// Can be useful for large where-in clauses, to get the db to use a hash lookup on the list
export const valuesList = (vals: unknown[]) => {
  return sql`(values (${sql.join(vals, sql`), (`)}))`
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

export type AnyQb = SelectQueryBuilder<any, any, any>
