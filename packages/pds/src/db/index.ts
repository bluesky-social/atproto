import assert from 'assert'
import {
  Kysely,
  SqliteDialect,
  PostgresDialect,
  Migrator,
  sql,
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  RootOperationNode,
  QueryResult,
  UnknownRow,
} from 'kysely'
import SqliteDB from 'better-sqlite3'
import { Pool as PgPool, Client as PgClient, types as pgTypes } from 'pg'
import EventEmitter from 'events'
import TypedEmitter from 'typed-emitter'
import { wait } from '@atproto/common'
import DatabaseSchema, { DatabaseSchemaType } from './database-schema'
import { dummyDialect } from './util'
import * as migrations from './migrations'
import { CtxMigrationProvider } from './migrations/provider'
import { dbLogger as log } from '../logger'
import { randomIntFromSeed } from '@atproto/crypto'

export class Database {
  txEvt = new EventEmitter() as TxnEmitter
  txChannelEvts: ChannelEvt[] = []
  txLockNonce: string | undefined
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
      new_repo_event: new EventEmitter() as ChannelEmitter,
      outgoing_repo_seq: new EventEmitter() as ChannelEmitter,
    }
    this.txLockNonce = cfg.dialect === 'pg' ? cfg.txLockNonce : undefined
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
    const { schema, url, txLockNonce } = opts
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
      // Used for trigram indexes, e.g. on actor search
      client.query('SET pg_trgm.strict_word_similarity_threshold TO .1;')
      if (schema) {
        // Shared objects such as extensions will go in the public schema
        client.query(`SET search_path TO "${schema}",public;`)
      }
    })

    const db = new Kysely<DatabaseSchemaType>({
      dialect: new PostgresDialect({ pool }),
    })

    return new Database(db, {
      dialect: 'pg',
      pool,
      schema,
      url,
      txLockNonce,
    })
  }

  static memory(): Database {
    return Database.sqlite(':memory:')
  }

  async startListeningToChannels() {
    if (this.cfg.dialect !== 'pg') return
    if (this.channelClient) return
    this.channelClient = new PgClient(this.cfg.url)
    await this.channelClient.connect()
    await this.channelClient.query(`LISTEN ${this.getSchemaChannel()}`)
    this.channelClient.on('notification', (msg) => {
      const channel = this.channels[msg.payload ?? '']
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

  async notify(evt: ChannelEvt) {
    // if in a sqlite tx, we buffer the notification until the tx successfully commits
    if (this.isTransaction && this.dialect === 'sqlite') {
      // no duplicate notifies in a tx per Postgres semantics
      if (!this.txChannelEvts.includes(evt)) {
        this.txChannelEvts.push(evt)
      }
    } else {
      await this.sendChannelEvt(evt)
    }
  }

  onCommit(fn: () => void) {
    this.assertTransaction()
    this.txEvt.once('commit', fn)
  }

  private getSchemaChannel() {
    const CHANNEL_NAME = 'pds_db_channel'
    if (this.cfg.dialect === 'pg' && this.cfg.schema) {
      return this.cfg.schema + '_' + CHANNEL_NAME
    } else {
      return CHANNEL_NAME
    }
  }

  private async sendChannelEvt(evt: ChannelEvt) {
    if (this.cfg.dialect === 'pg') {
      const { ref } = this.db.dynamic
      if (evt !== 'new_repo_event' && evt !== 'outgoing_repo_seq') {
        throw new Error(`Invalid evt: ${evt}`)
      }
      await sql`NOTIFY ${ref(this.getSchemaChannel())}, ${sql.literal(
        evt,
      )}`.execute(this.db)
    } else {
      const emitter = this.channels[evt]
      if (emitter) {
        emitter.emit('message')
      }
    }
  }

  async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    let txEvts: ChannelEvt[] = []
    const leakyTxPlugin = new LeakyTxPlugin()
    const { dbTxn, txRes } = await this.db
      .withPlugin(leakyTxPlugin)
      .transaction()
      .execute(async (txn) => {
        const dbTxn = new Database(txn, this.cfg, this.channels)
        const txRes = await fn(dbTxn)
          .catch(async (err) => {
            leakyTxPlugin.endTx()
            // ensure that all in-flight queries are flushed & the connection is open
            await dbTxn.db.getExecutor().provideConnection(async () => {})
            throw err
          })
          .finally(() => leakyTxPlugin.endTx())
        txEvts = dbTxn.txChannelEvts
        return { txRes, dbTxn }
      })
    dbTxn?.txEvt.emit('commit')
    txEvts.forEach((evt) => this.sendChannelEvt(evt))
    return txRes
  }

  async txAdvisoryLock(name: string): Promise<boolean> {
    this.assertTransaction()
    assert(this.dialect === 'pg', 'Postgres required')
    // any lock id < 10k is reserved for session locks
    const id = await randomIntFromSeed(name, Number.MAX_SAFE_INTEGER, 10000)
    const res = (await sql`SELECT pg_try_advisory_xact_lock(${sql.literal(
      id,
    )}) as acquired`.execute(this.db)) as TxLockRes
    return res.rows[0]?.acquired === true
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

  assertNotTransaction() {
    assert(!this.isTransaction, 'Cannot be in a transaction')
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
    if (this.schema) {
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

  async maintainMaterializedViews(opts: {
    views: string[]
    intervalSec: number
    signal: AbortSignal
  }) {
    assert(
      this.dialect === 'pg',
      'Can only maintain materialized views on postgres',
    )
    const { views, intervalSec, signal } = opts
    while (!signal.aborted) {
      // super basic synchronization by agreeing when the intervals land relative to unix timestamp
      const now = Date.now()
      const intervalMs = 1000 * intervalSec
      const nextIteration = Math.ceil(now / intervalMs)
      const nextInMs = nextIteration * intervalMs - now
      await wait(nextInMs)
      if (signal.aborted) break
      await Promise.all(
        views.map(async (view) => {
          try {
            await this.refreshMaterializedView(view)
            log.info(
              { view, time: new Date().toISOString() },
              'materialized view refreshed',
            )
          } catch (err) {
            log.error(
              { view, err, time: new Date().toISOString() },
              'materialized view refresh failed',
            )
          }
        }),
      )
    }
  }

  async refreshMaterializedView(view: string) {
    assert(
      this.dialect === 'pg',
      'Can only maintain materialized views on postgres',
    )
    const { ref } = this.db.dynamic
    await sql`refresh materialized view concurrently ${ref(view)}`.execute(
      this.db,
    )
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
  txLockNonce?: string
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
  poolSize?: number
  poolMaxUses?: number
  poolIdleTimeoutMs?: number
  txLockNonce?: string
}

type ChannelEvents = {
  message: () => void
}

type ChannelEmitter = TypedEmitter<ChannelEvents>

type Channels = {
  outgoing_repo_seq: ChannelEmitter
  new_repo_event: ChannelEmitter
}

type ChannelEvt = keyof Channels

type TxnEmitter = TypedEmitter<TxnEvents>

type TxnEvents = {
  commit: () => void
}

class LeakyTxPlugin implements KyselyPlugin {
  private txOver: boolean

  endTx() {
    this.txOver = true
  }

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    if (this.txOver) {
      throw new Error('tx already failed')
    }
    return args.node
  }

  async transformResult(
    args: PluginTransformResultArgs,
  ): Promise<QueryResult<UnknownRow>> {
    return args.result
  }
}

type TxLockRes = {
  rows: { acquired: true | false }[]
}
