import { DynamicModule, RawBuilder, SelectQueryBuilder, sql } from 'kysely'
// eslint-disable-next-line import/default
import pg from 'pg'
type PgPool = pg.Pool

export type DbRef =
  | RawBuilder<unknown>
  | ReturnType<DynamicModule<unknown>['ref']>

export type AnyQb = SelectQueryBuilder<any, any, any>

export type PgOptions = {
  url: string
  pool?: PgPool
  schema?: string
  poolSize?: number
  poolMaxUses?: number
  poolIdleTimeoutMs?: number
}

export const jsonb = <T>(val: T) => {
  if (val === null) return sql<T>`null`
  return sql<T>`${JSON.stringify(val)}::jsonb`
}
