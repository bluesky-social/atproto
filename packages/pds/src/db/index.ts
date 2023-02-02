import assert from 'assert'
import { Kysely, SqliteDialect, PostgresDialect, Migrator } from 'kysely'
import SqliteDB from 'better-sqlite3'
import {
  Pool as PgPool,
  PoolClient as PgPoolClient,
  types as pgTypes,
} from 'pg'
import DatabaseSchema, { DatabaseSchemaType } from './database-schema'
import { dummyDialect } from './util'
import * as migrations from './migrations'
import { CtxMigrationProvider } from './migrations/provider'

export class Database {
  listeners: Record<string, ListenerCB[]> = {}
  migrator: Migrator
  notifyClient: PgPoolClient | null = null

  constructor(public db: DatabaseSchema, public facets: DialectFacets) {
    this.migrator = new Migrator({
      db,
      migrationTableSchema: facets.dialect === 'pg' ? facets.schema : undefined,
      provider: new CtxMigrationProvider(migrations, facets.dialect),
    })
  }

  static sqlite(location: string): Database {
    const db = new Kysely<DatabaseSchemaType>({
      dialect: new SqliteDialect({
        database: new SqliteDB(location),
      }),
    })
    return new Database(db, { dialect: 'sqlite' })
  }

  static postgres(opts: PgOptions): Database {
    const { schema } = opts
    const pool =
      'pool' in opts ? opts.pool : new PgPool({ connectionString: opts.url })

    // Select count(*) and other pg bigints as js integer
    pgTypes.setTypeParser(pgTypes.builtins.INT8, (n) => parseInt(n, 10))

    // Setup schema usage, primarily for test parallelism (each test suite runs in its own pg schema)
    if (schema !== undefined) {
      if (!/^[a-z_]+$/i.test(schema)) {
        throw new Error(
          `Postgres schema must only contain [A-Za-z_]: ${schema}`,
        )
      }
      pool.on('connect', (client) =>
        // Shared objects such as extensions will go in the public schema
        client.query(`SET search_path TO "${schema}",public`),
      )
    }

    const db = new Kysely<DatabaseSchemaType>({
      dialect: new PostgresDialect({ pool }),
    })

    return new Database(db, { dialect: 'pg', pool, schema })
  }

  static memory(): Database {
    return Database.sqlite(':memory:')
  }

  notify(channel: string, msg?: string) {
    if (this.facets.dialect === 'pg') {
      this.facets.pool.query(`NOTIFY ${channel}, '${msg}'`)
    } else {
      const cbs = this.listeners[channel]
      if (cbs && cbs.length > 0) {
        for (const cb of cbs) {
          cb(msg)
        }
      }
    }
  }

  async listenFor(channel: string, cb: ListenerCB) {
    if (this.facets.dialect === 'pg') {
      if (!this.notifyClient) {
        this.notifyClient = await this.facets.pool.connect()
        this.notifyClient.query(`LISTEN ${channel}`)
        this.notifyClient.on('notification', (msg) => {
          const cbs = this.listeners[msg.channel]
          if (cbs && cbs.length > 0) {
            for (const cb of cbs) {
              cb(msg.payload)
            }
          }
        })
      }
      this.notifyClient.query(`LISTEN ${channel}`)
    }
    this.listeners[channel] ??= []
    this.listeners[channel].push(cb)
  }

  async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    return await this.db.transaction().execute((txn) => {
      const dbTxn = new Database(txn, this.facets)
      return fn(dbTxn)
    })
  }

  get schema(): string | undefined {
    return this.facets.dialect === 'pg' ? this.facets.schema : undefined
  }

  get dialect(): Dialect {
    return this.facets.dialect
  }

  get isTransaction() {
    return this.db.isTransaction
  }

  assertTransaction() {
    assert(this.isTransaction, 'Transaction required')
  }

  async close(): Promise<void> {
    this.notifyClient?.removeAllListeners()
    this.notifyClient?.release()
    await this.db.destroy()
  }

  async migrateToOrThrow(migration: string) {
    if (this.schema !== undefined) {
      await this.db.schema.createSchema(this.schema).ifNotExists().execute()
    }
    const { error, results } = await this.migrator.migrateTo(migration)
    if (error) {
      throw error
    }
    if (!results) {
      throw new Error('An unknown failure occurred while migrating')
    }
    return results
  }

  async migrateToLatestOrThrow() {
    if (this.schema !== undefined) {
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
}

export default Database

export type Dialect = 'pg' | 'sqlite'

export type DialectFacets = PgFacets | SqliteFacets

export type PgFacets = {
  dialect: 'pg'
  pool: PgPool
  notifyClient?: PgPoolClient
  schema?: string
}

export type SqliteFacets = {
  dialect: 'sqlite'
}

// Can use with typeof to get types for partial queries
export const dbType = new Kysely<DatabaseSchema>({ dialect: dummyDialect })

type PgOptions =
  | { url: string; schema?: string }
  | { pool: PgPool; schema?: string }

type ListenerCB = (msg: string | undefined) => void
