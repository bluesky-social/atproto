import EventEmitter from 'events'
import {
  Migrator,
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  RootOperationNode,
  QueryResult,
  UnknownRow,
  sql,
} from 'kysely'
import { Pool as PgPool } from 'pg'
import TypedEmitter from 'typed-emitter'
import { wait } from '@atproto/common'
import DatabaseSchema from './database-schema'
import * as migrations from './migrations'
import { CtxMigrationProvider } from './migrations/provider'
import { dbLogger as log } from '../logger'
import { PgOptions } from './types'
import { Database } from './db'

export class PrimaryDatabase extends Database {
  migrator: Migrator
  txEvt = new EventEmitter() as TxnEmitter
  destroyed = false
  isPrimary = true

  constructor(
    public opts: PgOptions,
    instances?: { db: DatabaseSchema; pool: PgPool },
  ) {
    super(opts, instances)
    this.migrator = new Migrator({
      db: this.db,
      migrationTableSchema: opts.schema,
      provider: new CtxMigrationProvider(migrations, 'pg'),
    })
  }

  static is(db: Database): db is PrimaryDatabase {
    return db.isPrimary
  }

  asPrimary(): PrimaryDatabase {
    return this
  }

  async transaction<T>(fn: (db: PrimaryDatabase) => Promise<T>): Promise<T> {
    const leakyTxPlugin = new LeakyTxPlugin()
    const { dbTxn, txRes } = await this.db
      .withPlugin(leakyTxPlugin)
      .transaction()
      .execute(async (txn) => {
        const dbTxn = new PrimaryDatabase(this.opts, {
          db: txn,
          pool: this.pool,
        })
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

export default PrimaryDatabase

// utils
// -------

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
