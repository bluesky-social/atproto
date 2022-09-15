import { cidForData } from '@adxp/common'
import { DataSource, SelectQueryBuilder } from 'typeorm'
import * as document from '../document'
import { Operation } from '../operations'
import { OperationsTable } from './operations-table'

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

  async opsForDid(did: string): Promise<Operation[]> {
    const query = this.db.createQueryBuilder()
    return this.opsForDidComposer(query, did)
  }

  async validateAndAddOp(did: string, proposed: Operation): Promise<void> {
    await this.db.manager.transaction(async (tx) => {
      const query = tx.createQueryBuilder()
      const ops = await this.opsForDidComposer(query, did)
      // throws if invalid
      await document.assureValidNextOp(did, ops, proposed)
      const cid = await cidForData(proposed)
      await tx
        .createQueryBuilder()
        .insert()
        .into(OperationsTable)
        .values({
          did,
          operation: JSON.stringify(proposed),
          cid: cid.toString(),
        })
        .execute()
    })
  }

  async opsForDidComposer(
    query: SelectQueryBuilder<any>,
    did: string,
  ): Promise<Operation[]> {
    const res = await query
      .select()
      .from(OperationsTable, 'op')
      .where('op.did = :did', { did })
      .orderBy('op.createdAt', 'ASC')
      .getMany()
    return res.map((row) => JSON.parse(row.operation))
  }
}
