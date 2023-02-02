import { Database } from '../../src'
import { randomStr } from '@atproto/crypto'
import { dataToCborBlock } from '@atproto/common'
import { Kysely } from 'kysely'
import { Block } from 'multiformats/block'
import * as uint8arrays from 'uint8arrays'

describe('user partitioned cids migration', () => {
  let db: Database
  let rawDb: Kysely<any>

  beforeAll(async () => {
    if (process.env.DB_POSTGRES_URL) {
      db = Database.postgres({
        url: process.env.DB_POSTGRES_URL,
        schema: 'migration_user_partitioned_cids',
      })
    } else {
      db = Database.memory()
    }
    await db.migrateToOrThrow('_20230201T200606704Z')

    rawDb = db.db
  })

  afterAll(async () => {
    await db.close()
  })

  const dids = ['did:example:one', 'did:example:two', 'did:example:three']
  const blocks: Block<unknown>[] = []

  it('fills the db with some cids', async () => {
    for (let i = 0; i < 4; i++) {
      const block = await dataToCborBlock({
        test: randomStr(32, 'base32'),
      })

      blocks.push(block)
    }

    const blocksToInsert = blocks.map((b) => ({
      cid: b.cid.toString(),
      size: b.bytes.length,
      content: b.bytes,
    }))
    await rawDb.insertInto('ipld_block').values(blocksToInsert).execute()

    // block 0 is owned by only user 0
    // block 1 is owned by only user 1
    // block 2 is owned by users 0 & 1
    // block 3 is owned by all three users
    const creatorsToInsert = [
      { cid: blocks[0].cid.toString(), did: dids[0] },
      { cid: blocks[1].cid.toString(), did: dids[1] },
      { cid: blocks[2].cid.toString(), did: dids[0] },
      { cid: blocks[2].cid.toString(), did: dids[1] },
      { cid: blocks[3].cid.toString(), did: dids[0] },
      { cid: blocks[3].cid.toString(), did: dids[1] },
      { cid: blocks[3].cid.toString(), did: dids[2] },
    ]
    await rawDb
      .insertInto('ipld_block_creator')
      .values(creatorsToInsert)
      .execute()
  })

  it('migrates up', async () => {
    const migration = await db.migrator.migrateTo('_20230202T170426672Z')
    expect(migration.error).toBeUndefined()
  })

  it('correctly partitions user ipld blocks', async () => {
    const fromDb = await rawDb.selectFrom('ipld_block').selectAll().execute()

    const first = fromDb.filter((b) => b.cid === blocks[0].cid.toString())
    expect(first.length).toBe(1)
    expect(first[0].creator).toEqual(dids[0])
    expect(uint8arrays.equals(first[0].content, blocks[0].bytes)).toBeTruthy()

    const second = fromDb.filter((b) => b.cid === blocks[1].cid.toString())
    expect(second.length).toBe(1)
    expect(second[0].creator).toEqual(dids[1])
    expect(uint8arrays.equals(second[0].content, blocks[1].bytes)).toBeTruthy()

    const third = fromDb.filter((b) => b.cid === blocks[2].cid.toString())
    expect(third.length).toBe(2)
    const thirdCreators = third.map((row) => row.creator)
    expect(thirdCreators.sort()).toEqual(dids.slice(0, 2).sort())
    third.forEach((row) => {
      expect(uint8arrays.equals(row.content, blocks[2].bytes)).toBeTruthy()
    })

    const fourth = fromDb.filter((b) => b.cid === blocks[3].cid.toString())
    expect(fourth.length).toBe(3)
    const fourthCreators = fourth.map((row) => row.creator)
    expect(fourthCreators.sort()).toEqual(dids.sort())
    fourth.forEach((row) => {
      expect(uint8arrays.equals(row.content, blocks[3].bytes)).toBeTruthy()
    })
  })
})
