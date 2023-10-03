import assert from 'assert'
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

export class UserDb {
  migrator: Migrator
  destroyed = false

  constructor(public db: Kysely<DatabaseSchema>) {
    this.migrator = new Migrator({
      db,
      provider: new CtxMigrationProvider(migrations),
    })
  }

  static sqlite(location: string): UserDb {
    const db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: new SqliteDB(location),
      }),
    })
    return new UserDb(db)
  }

  static memory(): UserDb {
    return UserDb.sqlite(':memory:')
  }

  async transaction<T>(fn: (db: UserDb) => Promise<T>): Promise<T> {
    const leakyTxPlugin = new LeakyTxPlugin()
    return this.db
      .withPlugin(leakyTxPlugin)
      .transaction()
      .execute(async (txn) => {
        const dbTxn = new UserDb(txn)
        const txRes = await fn(dbTxn)
          .catch(async (err) => {
            leakyTxPlugin.endTx()
            // ensure that all in-flight queries are flushed & the connection is open
            await dbTxn.db.getExecutor().provideConnection(async () => {})
            throw err
          })
          .finally(() => leakyTxPlugin.endTx())
        return txRes
      })
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
