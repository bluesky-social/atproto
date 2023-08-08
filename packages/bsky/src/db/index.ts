import assert from 'assert'
import EventEmitter from 'events'
import {
  Kysely,
  PostgresDialect,
  Migrator,
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  RootOperationNode,
  QueryResult,
  UnknownRow,
  sql,
} from 'kysely'
import { Pool as PgPool, types as pgTypes } from 'pg'
import TypedEmitter from 'typed-emitter'
import { wait } from '@atproto/common'
import DatabaseSchema, { DatabaseSchemaType } from './database-schema'
import * as migrations from './migrations'
import { CtxMigrationProvider } from './migrations/provider'
import { dbLogger as log } from '../logger'

export class Database {
  migrator: Migrator
  txEvt = new EventEmitter() as TxnEmitter
  destroyed = false

  constructor(public db: DatabaseSchema, public cfg: PgConfig) {
    this.migrator = new Migrator({
      db,
      migrationTableSchema: cfg.schema,
      provider: new CtxMigrationProvider(migrations, cfg.dialect),
    })
  }

  static postgres(opts: PgOptions): Database {
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
      // Used for trigram indexes, e.g. on actor search
      client.query('SET pg_trgm.word_similarity_threshold TO .4;')
      if (schema) {
        // Shared objects such as extensions will go in the public schema
        client.query(`SET search_path TO "${schema}",public;`)
      }
    })

    const db = new Kysely<DatabaseSchemaType>({
      dialect: new PostgresDialect({ pool }),
    })

    return new Database(db, { dialect: 'pg', pool, schema, url })
  }

  async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    const leakyTxPlugin = new LeakyTxPlugin()
    const { dbTxn, txRes } = await this.db
      .withPlugin(leakyTxPlugin)
      .transaction()
      .execute(async (txn) => {
        const dbTxn = new Database(txn, this.cfg)
        const txRes = await fn(dbTxn)
          .catch(async (err) => {
            leakyTxPlugin.endTx()
            // ensure that all in-flight queries are flushed & the connection is open
            await dbTxn.db.getExecutor().provideConnection(noopAsync)
            throw err
          })
          .finally(() => leakyTxPlugin.endTx())
        return { dbTxn, txRes }
      })
    dbTxn?.txEvt.emit('commit')
    return txRes
  }

  onCommit(fn: () => void) {
    this.assertTransaction()
    this.txEvt.once('commit', fn)
  }

  get schema(): string | undefined {
    return this.cfg.dialect === 'pg' ? this.cfg.schema : undefined
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
    const { ref } = this.db.dynamic
    await sql`refresh materialized view concurrently ${ref(view)}`.execute(
      this.db,
    )
  }
}

export default Database

export type PgConfig = {
  dialect: 'pg'
  pool: PgPool
  url: string
  schema?: string
}

type PgOptions = {
  url: string
  pool?: PgPool
  schema?: string
  poolSize?: number
  poolMaxUses?: number
  poolIdleTimeoutMs?: number
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

type TxnEmitter = TypedEmitter<TxnEvents>

type TxnEvents = {
  commit: () => void
}

const noopAsync = async () => {}
