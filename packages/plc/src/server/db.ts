import { Kysely, PostgresDialect, SqliteDialect } from 'kysely'
import SqliteDB from 'better-sqlite3'
import { Pool as PgPool, types as pgTypes } from 'pg'
import { CID } from 'multiformats/cid'
import { cidForData } from '@atproto/common'
import * as document from '../lib/document'
import * as t from '../lib/types'
import { ServerError } from './error'

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

export class Database {
  constructor(
    public db: Kysely<DatabaseSchema>,
    public dialect: Dialect,
    public schema?: string,
  ) {}

  static sqlite(location: string): Database {
    const db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: new SqliteDB(location),
      }),
    })
    return new Database(db, 'sqlite')
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

    const db = new Kysely<DatabaseSchema>({
      dialect: new PostgresDialect({ pool }),
    })

    return new Database(db, 'pg', schema)
  }

  static memory(): Database {
    return Database.sqlite(':memory:')
  }

  async close(): Promise<void> {
    await this.db.destroy()
  }

  async createTables(): Promise<this> {
    if (this.schema !== undefined) {
      await this.db.schema.createSchema(this.schema).ifNotExists().execute()
    }
    await this.db.schema
      .createTable('operations')
      .addColumn('did', 'varchar', (col) => col.notNull())
      .addColumn('operation', 'text', (col) => col.notNull())
      .addColumn('cid', 'varchar', (col) => col.notNull())
      .addColumn('nullified', 'int2', (col) => col.defaultTo(0))
      .addColumn('createdAt', 'varchar', (col) => col.notNull())
      .addPrimaryKeyConstraint('primary_key', ['did', 'cid'])
      .execute()
    return this
  }

  async dropTables(): Promise<void> {
    await this.db.schema.dropTable('operations').execute()
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
