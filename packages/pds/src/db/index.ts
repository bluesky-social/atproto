import assert from 'assert'
import { Kysely, SqliteDialect, PostgresDialect, Migrator } from 'kysely'
import SqliteDB from 'better-sqlite3'
import { Pool as PgPool, types as pgTypes } from 'pg'
import DatabaseSchema, { DatabaseSchemaType } from './database-schema'
import { dummyDialect } from './util'
import * as migrations from './migrations'
import { CtxMigrationProvider } from './migrations/provider'

export class Database {
  migrator: Migrator
  constructor(
    public db: DatabaseSchema,
    public dialect: Dialect,
    public schema?: string,
  ) {
    this.migrator = new Migrator({
      db,
      migrationTableSchema: schema,
      provider: new CtxMigrationProvider(migrations, dialect),
    })
  }

  static sqlite(location: string): Database {
    const db = new Kysely<DatabaseSchemaType>({
      dialect: new SqliteDialect({
        database: new SqliteDB(location),
      }),
    })
    return new Database(db, 'sqlite')
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
      pool.on('connect', (client) =>
        // Shared objects such as extensions will go in the public schema
        client.query(`SET search_path TO "${schema}",public`),
      )
    }

    const db = new Kysely<DatabaseSchemaType>({
      dialect: new PostgresDialect({ pool }),
    })

    return new Database(db, 'pg', schema)
  }

  static memory(): Database {
    return Database.sqlite(':memory:')
  }

  async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    return await this.db.transaction().execute((txn) => {
      const dbTxn = new Database(txn, this.dialect, this.schema)
      return fn(dbTxn)
    })
  }

  get isTransaction() {
    return this.db.isTransaction
  }

  assertTransaction() {
    assert(this.isTransaction, 'Transaction required')
  }

  async close(): Promise<void> {
    await this.db.destroy()
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

// Can use with typeof to get types for partial queries
export const dbType = new Kysely<DatabaseSchema>({ dialect: dummyDialect })

type PgOptions =
  | { url: string; schema?: string }
  | { pool: PgPool; schema?: string }
