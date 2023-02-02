import { Database } from '../../src'
import { randomStr } from '@atproto/crypto'
import { dataToCborBlock, TID } from '@atproto/common'
import { AtUri } from '@atproto/uri'
import { Kysely } from 'kysely'

describe('indexedAt on record migration', () => {
  let db: Database
  let rawDb: Kysely<any>

  beforeAll(async () => {
    if (process.env.DB_POSTGRES_URL) {
      db = Database.postgres({
        url: process.env.DB_POSTGRES_URL,
        schema: 'migration_indexed_at_on_record',
      })
    } else {
      db = Database.memory()
    }

    await db.migrateToOrThrow('_20221230T215012029Z')
    rawDb = db.db
  })

  afterAll(async () => {
    await db.close()
  })

  const randomDate = () => {
    const start = new Date(2022, 0, 1)
    const end = new Date()
    return new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime()),
    ).toISOString()
  }

  const times: { [cid: string]: string } = {}

  it('fills the db with some records & blocks', async () => {
    const blocks: any[] = []
    const records: any[] = []
    for (let i = 0; i < 100; i++) {
      const date = randomDate()
      const record = { test: randomStr(8, 'base32') }
      const block = await dataToCborBlock(record)
      blocks.push({
        cid: block.cid.toString(),
        content: block.bytes,
        size: block.bytes.length,
        indexedAt: date,
      })
      const uri = AtUri.make('did:example:alice', 'fake.posts', TID.nextStr())
      records.push({
        uri: uri.toString(),
        cid: block.cid.toString(),
        did: uri.hostname,
        collection: uri.collection,
        rkey: uri.rkey,
      })
      times[block.cid.toString()] = date
    }

    await rawDb.insertInto('ipld_block').values(blocks).execute()
    await rawDb.insertInto('record').values(records).execute()
  })

  it('migrates up', async () => {
    await db.migrateToOrThrow('_20230127T215753149Z')
  })

  it('associated the date to the correct record', async () => {
    const res = await rawDb.selectFrom('record').selectAll().execute()
    res.forEach((row) => {
      expect(row.indexedAt).toEqual(times[row.cid])
    })
  })
})
