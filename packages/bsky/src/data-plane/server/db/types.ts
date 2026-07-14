// eslint-disable-next-line import/default
import type pg from 'pg'
type PgPool = pg.Pool

export type PgOptions = {
  url: string
  pool?: PgPool
  schema?: string
  poolSize?: number
  poolMaxUses?: number
  poolIdleTimeoutMs?: number
}
