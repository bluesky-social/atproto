import assert from 'assert'
import { Kysely, PostgresDialect } from 'kysely'
import { Pool as PgPool, types as pgTypes } from 'pg'
import DatabaseSchema, { DatabaseSchemaType } from './database-schema'
import { PgOptions } from './types'
import { dbLogger } from '../logger'

export class Database {
  pool: PgPool
  db: DatabaseSchema
  destroyed = false
  isPrimary = false

  constructor(
    public opts: PgOptions,
    instances?: { db: DatabaseSchema; pool: PgPool },
  ) {
    // if instances are provided, use those
    if (instances) {
      this.db = instances.db
      this.pool = instances.pool
      return
    }

    // else create a pool & connect
    const { schema, url } = opts
    const pool =
      opts.pool ??
      new PgPool({
        connectionString: url,
        max: opts.poolSize,
        maxUses: opts.poolMaxUses,
        idleTimeoutMillis: opts.poolIdleTimeoutMs,
      })

    // Select count(*) and other pg bigints as js integer
    pgTypes.setTypeParser(pgTypes.builtins.INT8, (n) => parseInt(n, 10))

    // Setup schema usage, primarily for test parallelism (each test suite runs in its own pg schema)
    if (schema && !/^[a-z_]+$/i.test(schema)) {
      throw new Error(`Postgres schema must only contain [A-Za-z_]: ${schema}`)
    }

    pool.on('connect', (client) => {
      client.on('error', onClientError)
      // Used for trigram indexes, e.g. on actor search
      client.query('SET pg_trgm.word_similarity_threshold TO .4;')
      if (schema) {
        // Shared objects such as extensions will go in the public schema
        client.query(`SET search_path TO "${schema}",public;`)
      }
    })

    this.pool = pool
    this.db = new Kysely<DatabaseSchemaType>({
      dialect: new PostgresDialect({ pool }),
    })
  }

  get schema(): string | undefined {
    return this.opts.schema
  }

  get isTransaction() {
    return this.db.isTransaction
  }

  assertTransaction() {
    assert(this.isTransaction, 'Transaction required')
  }

  assertNotTransaction() {
    assert(!this.isTransaction, 'Cannot be in a transaction')
  }

  asPrimary(): Database {
    throw new Error('Primary db required')
  }

  async close(): Promise<void> {
    if (this.destroyed) return
    await this.db.destroy()
    this.destroyed = true
  }
}

export default Database

const onClientError = (err: Error) => dbLogger.error({ err }, 'db client error')
