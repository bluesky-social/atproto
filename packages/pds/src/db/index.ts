import assert from 'assert'
import { Kysely, SqliteDialect, PostgresDialect, Migrator, sql } from 'kysely'
import SqliteDB from 'better-sqlite3'
import { Pool as PgPool, Client as PgClient, types as pgTypes } from 'pg'
import EventEmitter from 'events'
import TypedEmitter from 'typed-emitter'
import DatabaseSchema, { DatabaseSchemaType } from './database-schema'
import { dummyDialect } from './util'
import * as migrations from './migrations'
import { CtxMigrationProvider } from './migrations/provider'
import { dbLogger as log } from '../logger'

export class Database {
  txChannelMsgs: ChannelMsg[] = []
  channels: Channels
  migrator: Migrator
  destroyed = false

  private channelClient: PgClient | null = null

  constructor(
    public db: DatabaseSchema,
    public cfg: DialectConfig,
    channels?: Channels,
  ) {
    this.migrator = new Migrator({
      db,
      migrationTableSchema: cfg.dialect === 'pg' ? cfg.schema : undefined,
      provider: new CtxMigrationProvider(migrations, cfg.dialect),
    })
    this.channels = channels || {
      repo_seq: new EventEmitter() as ChannelEmitter,
    }
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
    const { schema, url } = opts
    const pool = opts.pool ?? new PgPool({ connectionString: url })

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

    return new Database(db, { dialect: 'pg', pool, schema, url })
  }

  static memory(): Database {
    return Database.sqlite(':memory:')
  }

  async startListeningToChannels() {
    if (this.cfg.dialect !== 'pg') return
    if (this.channelClient) return
    this.channelClient = new PgClient(this.cfg.url)
    await this.channelClient.connect()
    await this.channelClient.query(
      `LISTEN ${this.getSchemaChannel('repo_seq')}`,
    )
    this.channelClient.on('notification', (msg) => {
      const channel = this.channels[this.normalizeSchemaChannel(msg.channel)]
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

  async notify(channel: keyof Channels) {
    if (channel !== 'repo_seq') {
      throw new Error(`attempted sending on unavailable channel: ${channel}`)
    }
    // hardcoded b/c of type system & we only have one msg type
    const message: ChannelMsg = 'repo_seq'

    // if in a sqlite tx, we buffer the notification until the tx successfully commits
    if (this.isTransaction && this.dialect === 'sqlite') {
      // no duplicate notifies in a tx per Postgres semantics
      if (!this.txChannelMsgs.includes(message)) {
        this.txChannelMsgs.push(message)
      }
    } else {
      await this.sendChannelMsg(message)
    }
  }

  private getSchemaChannel(channel: string) {
    if (this.cfg.dialect === 'pg' && this.cfg.schema) {
      return this.cfg.schema + '_' + channel
    } else {
      return channel
    }
  }

  private normalizeSchemaChannel(schemaChannel: string): string {
    if (this.cfg.dialect === 'pg' && this.cfg.schema) {
      const prefix = this.cfg.schema + '_'
      if (schemaChannel.startsWith(prefix)) {
        return schemaChannel.slice(prefix.length)
      } else {
        return schemaChannel
      }
    } else {
      return schemaChannel
    }
  }

  private async sendChannelMsg(channel: ChannelMsg) {
    if (this.cfg.dialect === 'pg') {
      const { ref } = this.db.dynamic
      await sql`NOTIFY ${ref(this.getSchemaChannel(channel))}`.execute(this.db)
    } else {
      const emitter = this.channels[channel]
      if (emitter) {
        emitter.emit('message')
      }
    }
  }

  async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    let txMsgs: ChannelMsg[] = []
    const res = await this.db.transaction().execute(async (txn) => {
      const dbTxn = new Database(txn, this.cfg, this.channels)
      const txRes = await fn(dbTxn)
      txMsgs = dbTxn.txChannelMsgs
      return txRes
    })
    txMsgs.forEach((msg) => {
      this.sendChannelMsg(msg)
    })
    return res
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
    if (this.destroyed) return
    if (this.channelClient) {
      await this.channelClient.end()
    }
    await this.db.destroy()
    this.destroyed = true
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
  url: string
  schema?: string
}

export type SqliteConfig = {
  dialect: 'sqlite'
}

// Can use with typeof to get types for partial queries
export const dbType = new Kysely<DatabaseSchema>({ dialect: dummyDialect })

type PgOptions = {
  url: string
  pool?: PgPool
  schema?: string
}

type ChannelEvents = {
  message: () => void
}

type ChannelEmitter = TypedEmitter<ChannelEvents>

type ChannelMsg = 'repo_seq'

type Channels = {
  repo_seq: ChannelEmitter
}
