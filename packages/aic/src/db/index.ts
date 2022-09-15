import { cidForData } from '@adxp/common'
import { DataSource } from 'typeorm'
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
    const found = await this.db
      .createQueryBuilder()
      .select()
      .from(OperationsTable, 'op')
      .where('op.did = :did', { did })
      .orderBy('op.createdAt', 'ASC')
      .getMany()

    return found.map((row) => JSON.parse(row.operation))
  }

  async addOpForDid(did: string, op: Operation): Promise<void> {
    await this.db.manager.transaction(async (tx) => {
      const mostRecent = await tx
        .createQueryBuilder()
        .select()
        .from(OperationsTable, 'op')
        .where('op.did = :did', { did })
        .orderBy('op.createdAt', 'DESC')
        .getOne()
      if (op.prev === null && mostRecent !== null) {
        throw new Error(`Genesis operation already exists for did`)
      }
      if (op.prev !== null && mostRecent?.cid !== op.prev) {
        throw new Error(`Operation not in order. Expected ${mostRecent?.cid}`)
      }
      const cid = await cidForData(op)
      await tx
        .createQueryBuilder()
        .insert()
        .into(OperationsTable)
        .values({
          did,
          operation: JSON.stringify(op),
          cid: cid.toString(),
        })
        .execute()
    })
  }
}
