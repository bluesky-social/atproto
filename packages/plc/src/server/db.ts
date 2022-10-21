import {
  Kysely,
  KyselyConfig,
  Migrator,
  PostgresDialect,
  SqliteDialect,
} from 'kysely'
import SqliteDB from 'better-sqlite3'
import { Pool as PgPool, types as pgTypes } from 'pg'
import { CID } from 'multiformats/cid'
import { cidForData } from '@atproto/common'
import * as document from '../lib/document'
import * as t from '../lib/types'
import { ServerError } from './error'
import * as migrations from './migrations'

export class Database {
  migrator: Migrator
  constructor(
    public db: KyselyWithDialect<DatabaseSchema>,
    public schema?: string,
  ) {
    this.migrator = new Migrator({
      db,
      migrationTableSchema: schema,
      provider: {
        async getMigrations() {
          return migrations
        },
      },
    })
  }

  static sqlite(location: string): Database {
    const db = new KyselyWithDialect<DatabaseSchema>('sqlite', {
      dialect: new SqliteDialect({
        database: new SqliteDB(location),
      }),
    })
    return new Database(db)
  }

  static postgres(opts: { url: string; schema?: string }): Database {
    const { url, schema } = opts
    const pool = new PgPool({ connectionString: url })

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

    const db = new KyselyWithDialect<DatabaseSchema>('pg', {
      dialect: new PostgresDialect({ pool }),
    })

    return new Database(db, schema)
  }

  static memory(): Database {
    return Database.sqlite(':memory:')
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

  async validateAndAddOp(did: string, proposed: t.Operation): Promise<void> {
    const ops = await this._opsForDid(did)
    // throws if invalid
    const { nullified, prev } = await document.assureValidNextOp(
      did,
      ops,
      proposed,
    )
    const cid = await cidForData(proposed)

    await this.db
      .transaction()
      .setIsolationLevel('serializable')
      .execute(async (tx) => {
        await tx
          .insertInto('operations')
          .values({
            did,
            operation: JSON.stringify(proposed),
            cid: cid.toString(),
            nullified: 0,
            createdAt: new Date().toISOString(),
          })
          .execute()

        if (nullified.length > 0) {
          const nullfiedStrs = nullified.map((cid) => cid.toString())
          await tx
            .updateTable('operations')
            .set({ nullified: 1 })
            .where('did', '=', did)
            .where('cid', 'in', nullfiedStrs)
            .execute()
        }

        // verify that the 2nd to last tx matches the proposed prev
        // otherwise rollback to prevent forks in history
        const mostRecent = await tx
          .selectFrom('operations')
          .select('cid')
          .where('did', '=', did)
          .where('nullified', '=', 0)
          .orderBy('createdAt', 'desc')
          .limit(2)
          .execute()
        const isMatch =
          (prev === null && !mostRecent[1]) ||
          (prev && prev.equals(CID.parse(mostRecent[1].cid)))
        if (!isMatch) {
          throw new ServerError(
            409,
            `Proposed prev does not match the most recent operation: ${mostRecent?.toString()}`,
          )
        }
      })
  }

  async mostRecentCid(did: string, notIncluded: CID[]): Promise<CID | null> {
    const notIncludedStr = notIncluded.map((cid) => cid.toString())

    const found = await this.db
      .selectFrom('operations')
      .select('cid')
      .where('did', '=', did)
      .where('nullified', '=', 0)
      .where('cid', 'not in', notIncludedStr)
      .orderBy('createdAt', 'desc')
      .executeTakeFirst()
    return found ? CID.parse(found.cid) : null
  }

  async opsForDid(did: string): Promise<t.Operation[]> {
    const ops = await this._opsForDid(did)
    return ops.map((op) => op.operation)
  }

  async _opsForDid(did: string): Promise<t.IndexedOperation[]> {
    const res = await this.db
      .selectFrom('operations')
      .selectAll()
      .where('did', '=', did)
      .where('nullified', '=', 0)
      .orderBy('createdAt', 'asc')
      .execute()

    return res.map((row) => ({
      did: row.did,
      operation: JSON.parse(row.operation),
      cid: CID.parse(row.cid),
      nullified: row.nullified === 1,
      createdAt: new Date(row.createdAt),
    }))
  }
}

export default Database

export type Dialect = 'pg' | 'sqlite'

// By placing the dialect on the kysely instance itself,
// you can utilize this information inside migrations.
export class KyselyWithDialect<DB> extends Kysely<DB> {
  constructor(public dialect: Dialect, config: KyselyConfig) {
    super(config)
  }
}

interface OperationsTable {
  did: string
  operation: string
  cid: string
  nullified: 0 | 1
  createdAt: string
}

interface DatabaseSchema {
  operations: OperationsTable
}
