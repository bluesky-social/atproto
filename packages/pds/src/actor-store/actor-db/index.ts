import assert from 'assert'
import path from 'path'
import {
  Kysely,
  SqliteDialect,
  Migrator,
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  RootOperationNode,
  QueryResult,
  UnknownRow,
} from 'kysely'
import SqliteDB from 'better-sqlite3'
import { DatabaseSchema } from './schema'
import * as migrations from './migrations'
import { CtxMigrationProvider } from './migrations/provider'
export * from './schema'

type CommitHook = () => void

export class ActorDb {
  migrator: Migrator
  destroyed = false
  commitHooks: CommitHook[] = []

  constructor(public did: string, public db: Kysely<DatabaseSchema>) {
    this.migrator = new Migrator({
      db,
      provider: new CtxMigrationProvider(migrations),
    })
  }

  static sqlite(location: string, did: string): ActorDb {
    const db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: new SqliteDB(path.join(location, did)),
      }),
    })
    return new ActorDb(did, db)
  }

  async transaction<T>(fn: (db: ActorDb) => Promise<T>): Promise<T> {
    const leakyTxPlugin = new LeakyTxPlugin()
    const { hooks, txRes } = await this.db
      .withPlugin(leakyTxPlugin)
      .transaction()
      .execute(async (txn) => {
        const dbTxn = new ActorDb(this.did, txn)
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

  async migrateToOrThrow(migration: string) {
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
