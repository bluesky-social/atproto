import assert from 'assert'
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
} from 'kysely'
import TypedEmitter from 'typed-emitter'
import { Pool as PgPool, types as pgTypes } from 'pg'
import DatabaseSchema, { DatabaseSchemaType } from './schema'
import { PgOptions } from './types'
import { dbLogger } from '../logger'
import { EventEmitter } from 'stream'
import * as migrations from './migrations'
import { DbMigrationProvider } from './migrations/provider'

export class Database {
  pool: PgPool
  db: DatabaseSchema
  migrator: Migrator
  txEvt = new EventEmitter() as TxnEmitter
  destroyed = false

  constructor(
    public opts: PgOptions,
    instances?: { db: DatabaseSchema; pool: PgPool },
  ) {
    // if instances are provided, use those
    if (instances) {
      this.db = instances.db
      this.pool = instances.pool
    } else {
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
        throw new Error(
          `Postgres schema must only contain [A-Za-z_]: ${schema}`,
        )
      }

      pool.on('error', onPoolError)
      pool.on('connect', (client) => {
        client.on('error', onClientError)
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

    this.migrator = new Migrator({
      db: this.db,
      migrationTableSchema: opts.schema,
      provider: new DbMigrationProvider(migrations),
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

  async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    const leakyTxPlugin = new LeakyTxPlugin()
    const { dbTxn, txRes } = await this.db
      .withPlugin(leakyTxPlugin)
      .transaction()
      .execute(async (txn) => {
        const dbTxn = new Database(this.opts, {
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
}

export default Database

const onPoolError = (err: Error) => dbLogger.error({ err }, 'db pool error')
const onClientError = (err: Error) => dbLogger.error({ err }, 'db client error')

// utils
// -------

class LeakyTxPlugin implements KyselyPlugin {
  private txOver = false

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
