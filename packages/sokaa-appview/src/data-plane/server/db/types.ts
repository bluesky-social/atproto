import { Pool as PgPool } from 'pg'

// Connection options for `new Database(opts)`. Used by db.ts, migration tests,
// and (in later phases) the firehose indexer + dev-env server startup.

export type PgOptions = {
  url: string
  pool?: PgPool
  schema?: string
  poolSize?: number
  poolMaxUses?: number
  poolIdleTimeoutMs?: number
}
