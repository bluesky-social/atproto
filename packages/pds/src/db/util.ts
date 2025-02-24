import {
  DummyDriver,
  DynamicModule,
  Kysely,
  RawBuilder,
  ReferenceExpression,
  SelectQueryBuilder,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  sql,
} from 'kysely'
import { retry } from '@atproto/common'

// Applies to repo_root or record table
export const notSoftDeletedClause = (alias: DbRef) => {
  return sql`${alias}."takedownRef" is null`
}

export const softDeleted = (repoOrRecord: { takedownRef: string | null }) => {
  return repoOrRecord.takedownRef !== null
}

export const countAll = sql<number>`count(*)`
export const countDistinct = (ref: DbRef) => sql<number>`count(distinct ${ref})`

// For use with doUpdateSet()
export const excluded = <T, S>(db: Kysely<S>, col) => {
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

export const retrySqlite = <T>(fn: () => Promise<T>): Promise<T> => {
  return retry(fn, {
    retryable: retryableSqlite,
    getWaitMs: getWaitMsSqlite,
    maxRetries: 60, // a safety measure: getWaitMsSqlite() times out before this after 5000ms of waiting.
  })
}

const retryableSqlite = (err: unknown) => {
  return typeof err?.['code'] === 'string' && RETRY_ERRORS.has(err['code'])
}

// based on sqlite's backoff strategy https://github.com/sqlite/sqlite/blob/91c8e65dd4bf17d21fbf8f7073565fe1a71c8948/src/main.c#L1704-L1713
const getWaitMsSqlite = (n: number, timeout = 5000) => {
  if (n < 0) return null
  let delay: number
  let prior: number
  if (n < DELAYS.length) {
    delay = DELAYS[n]
    prior = TOTALS[n]
  } else {
    delay = last(DELAYS)
    prior = last(TOTALS) + delay * (n - (DELAYS.length - 1))
  }
  if (prior + delay > timeout) {
    delay = timeout - prior
    if (delay <= 0) return null
  }
  return delay
}

const last = <T>(arr: T[]) => arr[arr.length - 1]
const DELAYS = [1, 2, 5, 10, 15, 20, 25, 25, 25, 50, 50, 100]
const TOTALS = [0, 1, 3, 8, 18, 33, 53, 78, 103, 128, 178, 228]
const RETRY_ERRORS = new Set([
  'SQLITE_BUSY',
  'SQLITE_BUSY_SNAPSHOT',
  'SQLITE_BUSY_RECOVERY',
  'SQLITE_BUSY_TIMEOUT',
])

export type Ref = ReferenceExpression<any, any>

export type DbRef = RawBuilder | ReturnType<DynamicModule['ref']>

export type AnyQb = SelectQueryBuilder<any, any, any>

export const isErrUniqueViolation = (err: unknown) => {
  const code = err?.['code']
  return (
    code === '23505' || // postgres, see https://www.postgresql.org/docs/current/errcodes-appendix.html
    code === 'SQLITE_CONSTRAINT_UNIQUE' // sqlite, see https://www.sqlite.org/rescode.html#constraint_unique
  )
}
