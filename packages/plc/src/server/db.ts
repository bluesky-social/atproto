import { CID } from 'multiformats/cid'
import { cidForData } from '@adxp/common'
import {
  EntityManager,
  DataSource,
  Entity,
  Column,
  PrimaryColumn,
  In,
  Not,
} from 'typeorm'
import { Mutex } from 'async-mutex'
import * as document from '../lib/document'
import * as t from '../lib/types'
import { ServerError } from './error'

export class Database {
  db: SafeDB

  constructor(db: SafeDB) {
    this.db = db
  }

  static async sqlite(location: string): Promise<Database> {
    const db = await SafeDB.sqlite(location)
    return new Database(db)
  }

  static async memory(): Promise<Database> {
    const db = await SafeDB.memory()
    return new Database(db)
  }

  async close(): Promise<void> {
    await this.db.close()
  }

  async validateAndAddOp(did: string, proposed: t.Operation): Promise<void> {
    const ops = await this.db.readOperation(async (manager) => {
      return this._opsForDid(manager, did)
    })
    // throws if invalid
    const { nullified, prev } = await document.assureValidNextOp(
      did,
      ops,
      proposed,
    )
    const cid = await cidForData(proposed)

    await this.db.transaction(async (tx) => {
      const mostRecent = await this._mostRecentCid(tx, did, nullified)
      const isMatch =
        (prev === null && mostRecent === null) ||
        (prev && prev.equals(mostRecent))

      if (!isMatch) {
        throw new ServerError(
          409,
          `Proposed prev does not match the most recent operation: ${mostRecent?.toString()}`,
        )
      }

      const toInsert = new OperationsTable()
      toInsert.did = did
      toInsert.operation = JSON.stringify(proposed)
      toInsert.cid = cid.toString()
      toInsert.createdAt = new Date()
      await tx.save(toInsert)

      if (nullified.length > 0) {
        const nullfiedStrs = nullified.map((cid) => cid.toString())
        await tx.update(
          OperationsTable,
          { did, cid: In(nullfiedStrs) },
          { nullified: true },
        )
      }
    })
  }

  async mostRecentCid(did: string): Promise<CID | null> {
    return this.db.readOperation(async (manager) => {
      return this._mostRecentCid(manager, did, [])
    })
  }

  async _mostRecentCid(
    manager: EntityManager,
    did: string,
    notIncluded: CID[],
  ): Promise<CID | null> {
    const notIncludedStr = notIncluded.map((cid) => cid.toString())
    const found = await manager.find(OperationsTable, {
      where: { did, nullified: false, cid: Not(In(notIncludedStr)) },
      order: { createdAt: 'DESC' },
      take: 1,
    })
    return found[0] ? CID.parse(found[0].cid) : null
  }

  async opsForDid(did: string): Promise<t.Operation[]> {
    return this.db.readOperation(async (manager) => {
      const res = await this._opsForDid(manager, did)
      return res.map((row) => row.operation)
    })
  }

  // helper fn that returns additional information
  async _opsForDid(
    manager: EntityManager,
    did: string,
  ): Promise<t.IndexedOperation[]> {
    const res = await manager.findBy(OperationsTable, {
      did,
      nullified: false,
    })
    return res
      .map((row) => ({
        did: row.did,
        operation: JSON.parse(row.operation),
        cid: CID.parse(row.cid),
        nullified: row.nullified,
        createdAt: row.createdAt,
      }))
      .sort((a, b) => {
        return a.createdAt.getTime() - b.createdAt.getTime()
      })
  }
}

// It is VERY IMPORTANT that any writes go through the `transaction` method on the underlying SafeDB
// This is needed because sqlite does not offer a connection pool & transactions can end up getting nested
// and either fail or return successful but then get rolledback if the outer tx fails
class SafeDB {
  private db: DataSource
  private lock: Mutex

  constructor(db: DataSource) {
    this.db = db
    this.lock = new Mutex()
  }

  static async sqlite(location: string): Promise<SafeDB> {
    const db = new DataSource({
      type: 'sqlite',
      database: location,
      entities: [OperationsTable],
      synchronize: true,
    })
    await db.initialize()
    return new SafeDB(db)
  }

  static async memory(): Promise<SafeDB> {
    return SafeDB.sqlite(':memory:')
  }

  async close(): Promise<void> {
    await this.db.destroy()
  }

  async transaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    const release = await this.lock.acquire()
    let res: T
    try {
      res = await this.db.manager.transaction(async (tx) => {
        return fn(this.db.manager)
      })
    } catch (err) {
      release()
      throw err
    }
    release()
    return res
  }

  async readOperation<T>(
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return fn(this.db.manager)
  }
}

@Entity({ name: 'operations' })
export class OperationsTable {
  @PrimaryColumn('varchar')
  did: string

  @Column('text')
  operation: string

  @PrimaryColumn('varchar')
  cid: string

  // used for operations that were on a historical fork of the DID doc that are no longer in the canonical history
  // for instance after a recovery operation
  @Column({ type: 'boolean', default: false })
  nullified: boolean

  @Column('datetime')
  createdAt: Date
}

export default Database
