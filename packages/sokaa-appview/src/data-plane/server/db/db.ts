import { Kysely, Migrator, PostgresDialect } from 'kysely'
import { Pool as PgPool, types as pgTypes } from 'pg'
import { DatabaseSchema, DatabaseSchemaType } from './database-schema'
import * as migrations from './migrations'
import { CtxMigrationProvider } from './migrations/provider'
import { PgOptions } from './types'

export type { DatabaseSchema }

export class Database {
  pool: PgPool
  db: DatabaseSchema
  migrator: Migrator
  destroyed = false

  constructor(
    public opts: PgOptions,
    instances?: { db: DatabaseSchema; pool: PgPool; migrator: Migrator },
  ) {
    if (instances) {
      this.db = instances.db
      this.pool = instances.pool
      this.migrator = instances.migrator
      return
    }

    const { schema, url } = opts
    const pool =
      opts.pool ??
      new PgPool({
        connectionString: url,
        max: opts.poolSize,
        maxUses: opts.poolMaxUses,
        idleTimeoutMillis: opts.poolIdleTimeoutMs,
      })

    pgTypes.setTypeParser(pgTypes.builtins.INT8, (n) => parseInt(n, 10))

    if (schema && !/^[a-z_]+$/i.test(schema)) {
      throw new Error(`Postgres schema must only contain [A-Za-z_]: ${schema}`)
    }

    pool.on('error', onPoolError)
    pool.on('connect', (client) => {
      client.on('error', onClientError)
      if (schema) {
        client.query(`SET search_path TO "${schema}",public;`)
      }
    })

    this.pool = pool
    this.db = new Kysely<DatabaseSchemaType>({
      dialect: new PostgresDialect({ pool }),
    })
    this.migrator = new Migrator({
      db: this.db,
      migrationTableSchema: opts.schema,
      provider: new CtxMigrationProvider(migrations, 'pg'),
    })
  }

  get schema(): string | undefined {
    return this.opts.schema
  }

  async migrateToLatestOrThrow() {
    if (this.schema) {
      await this.db.schema.createSchema(this.schema).ifNotExists().execute()
    }
    const { error, results } = await this.migrator.migrateToLatest()
    if (error) {
      throw error
    }
    if (!results) {
      throw new Error('An unknown failure occurred while migrating')
    }
    return results
  }

  async close(): Promise<void> {
    if (this.destroyed) return
    await this.db.destroy()
    this.destroyed = true
  }
}

export default Database

const onPoolError = (err: Error) => {
  console.error('db pool error', err)
}

const onClientError = (err: Error) => {
  console.error('db client error', err)
}
