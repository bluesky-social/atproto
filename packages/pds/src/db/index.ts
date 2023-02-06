import assert from 'assert'
import { Kysely, SqliteDialect, PostgresDialect, Migrator } from 'kysely'
import SqliteDB from 'better-sqlite3'
import {
  Pool as PgPool,
  PoolClient as PgPoolClient,
  types as pgTypes,
} from 'pg'
import EventEmitter from 'events'
import TypedEmitter from 'typed-emitter'
import DatabaseSchema, { DatabaseSchemaType } from './database-schema'
import { dummyDialect } from './util'
import * as migrations from './migrations'
import { CtxMigrationProvider } from './migrations/provider'
import { dbLogger as log } from '../logger'

export class Database {
  channels: Channels = {
    repo_seq: new EventEmitter() as ChannelEmitter,
  }
  migrator: Migrator
  private channelClient: PgPoolClient | null = null

  constructor(public db: DatabaseSchema, public cfg: DialectConfig) {
    this.migrator = new Migrator({
      db,
      migrationTableSchema: cfg.dialect === 'pg' ? cfg.schema : undefined,
      provider: new CtxMigrationProvider(migrations, cfg.dialect),
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
      pool.on('connect', (client) => {
        // Shared objects such as extensions will go in the public schema
        client.query(`SET search_path TO "${schema}",public`)
      })
    }

    const db = new Kysely<DatabaseSchemaType>({
      dialect: new PostgresDialect({ pool }),
    })

    return new Database(db, { dialect: 'pg', pool, schema })
  }

  static memory(): Database {
    return Database.sqlite(':memory:')
  }

  async startListeningToChannels() {
    if (this.cfg.dialect !== 'pg') return
    this.channelClient = await this.cfg.pool.connect()
    await this.channelClient.query(`LISTEN repo_seq`)
    this.channelClient.on('notification', (msg) => {
      const channel = this.channels[msg.channel]
      if (channel) {
        channel.emit('message')
      }
    })
    this.channelClient.on('error', (err) => {
      log.error({ err }, 'postgres listener errored, reconnecting')
      this.channelClient?.removeAllListeners()
      this.startListeningToChannels()
    })
  }

  notify(channel: keyof Channels) {
    if (channel !== 'repo_seq') {
      throw new Error(`attempted sending on unavailable channel: ${channel}`)
    }
    if (this.cfg.dialect === 'pg') {
      this.cfg.pool.query(`NOTIFY ${channel}`)
    } else {
      const emitter = this.channels[channel]
      if (emitter) {
        emitter.emit('message')
      }
    }
  }

  async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    return await this.db.transaction().execute((txn) => {
      const dbTxn = new Database(txn, this.cfg)
      return fn(dbTxn)
    })
  }

  get schema(): string | undefined {
    return this.cfg.dialect === 'pg' ? this.cfg.schema : undefined
  }

  get dialect(): Dialect {
    return this.cfg.dialect
  }

  get isTransaction() {
    return this.db.isTransaction
  }

  assertTransaction() {
    assert(this.isTransaction, 'Transaction required')
  }

  async close(): Promise<void> {
    this.channelClient?.removeAllListeners()
    this.channelClient?.release()
    // @TODO investigate
    // if (this.cfg.dialect === 'pg') {
    //   await this.cfg.pool.end()
    // }
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

export type DialectConfig = PgConfig | SqliteConfig

export type PgConfig = {
  dialect: 'pg'
  pool: PgPool
  schema?: string
}

export type SqliteConfig = {
  dialect: 'sqlite'
}

// Can use with typeof to get types for partial queries
export const dbType = new Kysely<DatabaseSchema>({ dialect: dummyDialect })

type PgOptions =
  | { url: string; schema?: string }
  | { pool: PgPool; schema?: string }

type ChannelEvents = {
  message: () => void
}

type ChannelEmitter = TypedEmitter<ChannelEvents>

type Channels = {
  repo_seq: ChannelEmitter
}
