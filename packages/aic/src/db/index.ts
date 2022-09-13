import { DataSource } from 'typeorm'
import { AicTick } from './aic-tick'

export class Database {
  db: DataSource
  constructor(db: DataSource) {
    this.db = db
  }
  static async sqlite(location: string): Promise<Database> {
    const db = new DataSource({
      type: 'sqlite',
      database: location,
      entities: [AicTick],
      synchronize: true,
    })
    await db.initialize()
    return new Database(db)
  }

  static async memory(): Promise<Database> {
    return Database.sqlite(':memory:')
  }
  // retrieves the latest tick
  async tickForDid(
    did: string,
  ): Promise<{ did: string; tid: string; tick: string } | null> {
    const found = this.db
      .createQueryBuilder()
      .select(['did', 'tid', 'tick'])
      .from(AicTick, 'tick')
      .where('did = :did', { did })
      .orderBy('did', 'DESC')
      .limit(1)
      .getRawOne()

    return found
  }

  // atomically update the tick, only if prevTid is the head
  async putTickForDid(
    did: string,
    tid: string, // the new tid must me larger then the previous tid
    prevTid: string | null, // gard: if the prevTid has changed the tick from the db is stale
    tick: string, // the tick is a json string
  ): Promise<void> {
    // @TODO could use returning('*') here to avoid refetch and reflect exact result of the insert
    // This is just a db wrapper confirm that the tick is valid before calling
    // whereJsonPath('diff', '$.prev', '=', )
    // if (prevTid === null) {
    //   await db('aic_ticks').insert({ did, tid, tick })
    // } else {
    // the tid must be both
    // prevTid must be the greatest tid for that pid in the
    // note: we don't return failures: the client must pull to learn they updated the did
    // await db('aic_ticks')
    //   .insert({ did, tid, tick })
    //   .whereExists(db('aic_ticks').max('tid').where(tid, prevTid))
    // }
  }
}
