import { CID } from 'multiformats/cid'
import { cidForData } from '@adxp/common'
import {
  DataSource,
  SelectQueryBuilder,
  Entity,
  Column,
  PrimaryColumn,
} from 'typeorm'
import * as document from '../lib/document'
import * as t from '../lib/types'

export class Database {
  db: DataSource
  constructor(db: DataSource) {
    this.db = db
  }
  static async sqlite(location: string): Promise<Database> {
    const db = new DataSource({
      type: 'sqlite',
      database: location,
      entities: [OperationsTable],
      synchronize: true,
    })
    await db.initialize()
    return new Database(db)
  }

  static async memory(): Promise<Database> {
    return Database.sqlite(':memory:')
  }

  async close(): Promise<void> {
    await this.db.destroy()
  }

  async opsForDid(did: string): Promise<t.Operation[]> {
    const query = this.db.createQueryBuilder()
    const res = await this.opsForDidComposer(query, did)
    return res.map((row) => row.operation)
  }

  async validateAndAddOp(did: string, proposed: t.Operation): Promise<void> {
    await this.db.manager.transaction(async (tx) => {
      const query = tx.createQueryBuilder()
      const ops = await this.opsForDidComposer(query, did)
      // throws if invalid
      const { nullified } = await document.assureValidNextOp(did, ops, proposed)
      const cid = await cidForData(proposed)
      await tx
        .createQueryBuilder()
        .insert()
        .into(OperationsTable)
        .values({
          did,
          operation: JSON.stringify(proposed),
          cid: cid.toString(),
          nullified: false,
          createdAt: new Date().toISOString(),
        })
        .execute()
      if (nullified.length > 0) {
        await tx
          .createQueryBuilder()
          .update(OperationsTable)
          .set({ nullified: true })
          .where('did = :did', { did })
          .andWhere('cid = IN (:...cids)', {
            cids: nullified.map((cid) => cid.toString()),
          })
      }
    })
  }

  async opsForDidComposer(
    query: SelectQueryBuilder<any>,
    did: string,
  ): Promise<t.IndexedOperation[]> {
    const res = await query
      .select('op')
      .from(OperationsTable, 'op')
      .where('op.did = :did', { did })
      .andWhere('op.nullified = :nullified', { nullified: false })
      .orderBy('op.createdAt', 'ASC')
      .getMany()
    return res.map((row) => ({
      did: row.did,
      operation: JSON.parse(row.operation),
      cid: CID.parse(row.cid),
      nullified: row.nullified,
      createdAt: row.createdAt,
    }))
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
