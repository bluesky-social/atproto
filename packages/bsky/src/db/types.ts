import { Pool as PgPool } from 'pg'

export type PgConfig = {
  pool: PgPool
  url: string
  schema?: string
}

export type PgOptions = {
  url: string
  pool?: PgPool
  schema?: string
  poolSize?: number
  poolMaxUses?: number
  poolIdleTimeoutMs?: number
}
