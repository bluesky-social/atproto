import assert from 'assert'
import {
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
import { retry } from '@atproto/common'

const DEFAULT_PRAGMAS = {
  journal_mode: 'WAL',
  busy_timeout: '5000',
  strict: 'ON',
}

const RETRY_ERRORS = new Set(['SQLITE_BUSY', 'SQLITE_BUSY_SNAPSHOT'])

export class Database<Schema> {
  destroyed = false
  commitHooks: CommitHook[] = []

  constructor(public db: Kysely<Schema>) {}

  static sqlite<T>(
    location: string,
    opts?: { pragmas?: Record<string, string> },
  ): Database<T> {
    const sqliteDb = new SqliteDB(location)
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
    return retry(() => this.transactionNoRetry(fn), {
      retryable: (err) =>
        typeof err?.['code'] === 'string' && RETRY_ERRORS.has(err['code']),
      maxRetries: 5,
      backoffMultiplier: 50,
      backoffMax: 2000,
    })
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

  async close(): Promise<void> {
    if (this.destroyed) return
    await this.db.destroy()
    this.destroyed = true
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
