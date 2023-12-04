import assert from 'assert'
import {
  sql,
  Kysely,
  SqliteDialect,
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  RootOperationNode,
  QueryResult,
  UnknownRow,
} from 'kysely'
import SqliteDB from 'better-sqlite3'
import { dbLogger } from '../logger'
import { retrySqlite } from './util'

const DEFAULT_PRAGMAS = {
  // strict: 'ON', // @TODO strictness should live on table defs instead
}

export class Database<Schema> {
  destroyed = false
  commitHooks: CommitHook[] = []

  constructor(public db: Kysely<Schema>) {}

  static sqlite<T>(
    location: string,
    opts?: { pragmas?: Record<string, string> },
  ): Database<T> {
    const sqliteDb = new SqliteDB(location, {
      timeout: 0, // handled by application
    })
    const pragmas = {
      ...DEFAULT_PRAGMAS,
      ...(opts?.pragmas ?? {}),
    }
    for (const pragma of Object.keys(pragmas)) {
      sqliteDb.pragma(`${pragma} = ${pragmas[pragma]}`)
    }
    const db = new Kysely<T>({
      dialect: new SqliteDialect({
        database: sqliteDb,
      }),
    })
    return new Database(db)
  }

  async ensureWal() {
    await sql`PRAGMA journal_mode = WAL`.execute(this.db)
  }

  async transactionNoRetry<T>(
    fn: (db: Database<Schema>) => Promise<T>,
  ): Promise<T> {
    this.assertNotTransaction()
    const leakyTxPlugin = new LeakyTxPlugin()
    const { hooks, txRes } = await this.db
      .withPlugin(leakyTxPlugin)
      .transaction()
      .execute(async (txn) => {
        const dbTxn = new Database(txn)
        const txRes = await fn(dbTxn)
          .catch(async (err) => {
            leakyTxPlugin.endTx()
            // ensure that all in-flight queries are flushed & the connection is open
            await dbTxn.db.getExecutor().provideConnection(async () => {})
            throw err
          })
          .finally(() => leakyTxPlugin.endTx())
        const hooks = dbTxn.commitHooks
        return { hooks, txRes }
      })
    hooks.map((hook) => hook())
    return txRes
  }

  async transaction<T>(fn: (db: Database<Schema>) => Promise<T>): Promise<T> {
    return retrySqlite(() => this.transactionNoRetry(fn))
  }

  async executeWithRetry<T>(query: { execute: () => Promise<T> }) {
    if (this.isTransaction) {
      // transaction() ensures retry on entire transaction, no need to retry individual statements.
      return query.execute()
    }
    return retrySqlite(() => query.execute())
  }

  onCommit(fn: () => void) {
    this.assertTransaction()
    this.commitHooks.push(fn)
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

  close(): void {
    if (this.destroyed) return
    this.db
      .destroy()
      .then(() => (this.destroyed = true))
      .catch((err) => dbLogger.error({ err }, 'error closing db'))
  }
}

type CommitHook = () => void

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
