import { DynamicModule, RawBuilder, SelectQueryBuilder, sql } from 'kysely'
import { Pool as PgPool } from 'pg'

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

export type JsonScalar = string | number | boolean | null
export type Json = JsonScalar | { [k in string]?: Json } | Json[]
export type JsonObject = { [k in string]?: Json }
export type JsonArray = Json[]

export const jsonIsObject = <T extends Json>(val?: T): val is T & JsonObject =>
  val != null && typeof val === 'object' && !Array.isArray(val)

export const jsonb = <T>(val: T) => {
  if (val === null) return sql<T>`null`
  return sql<T>`${JSON.stringify(val)}::jsonb`
}
