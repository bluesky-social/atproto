import { Pool as PgPool } from 'pg'
import { DynamicModule, RawBuilder, SelectQueryBuilder, sql } from 'kysely'

export type DbRef = RawBuilder | ReturnType<DynamicModule['ref']>

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
