import { range, dataToCborBlock, TID } from '@atproto/common'
import { CidSet, def } from '@atproto/repo'
import BlockMap from '@atproto/repo/src/block-map'
import { Database } from '../src'
import SqlRepoStorage from '../src/sql-repo-storage'
import { CloseFn, runTestServer } from './_util'
import { CID } from 'multiformats/cid'

describe('sql repo storage', () => {
  let db: Database
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'sql_repo_storage',
    })
    close = server.close
    db = server.ctx.db
  })

  afterAll(async () => {
    await close()
  })

  it('puts and gets blocks.', async () => {
    const did = 'did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme'

    const cid = await db.transaction(async (dbTxn) => {
      const storage = new SqlRepoStorage(dbTxn, did)
      const block = await dataToCborBlock({ my: 'block' })
      await storage.putBlock(block.cid, block.bytes)
      return block.cid
    })

    const storage = new SqlRepoStorage(db, did)
    const value = await storage.readObj(cid, def.unknown)

    expect(value).toEqual({ my: 'block' })
  })

  it('allows same content to be put multiple times by the same did.', async () => {
    const did = 'did:key:zQ3shtxV1FrJfhqE1dvxYRcCknWNjHc3c5X1y3ZSoPDi2aur2'

    const cidA = await db.transaction(async (dbTxn) => {
      const storage = new SqlRepoStorage(dbTxn, did)
      const block = await dataToCborBlock({ my: 'block' })
      await storage.putBlock(block.cid, block.bytes)
      return block.cid
    })

    const cidB = await db.transaction(async (dbTxn) => {
      const storage = new SqlRepoStorage(dbTxn, did)
      const block = await dataToCborBlock({ my: 'block' })
      await storage.putBlock(block.cid, block.bytes)
      return block.cid
    })

    expect(cidA.equals(cidB)).toBe(true)
  })

  it('applies commits', async () => {
    const did = 'did:key:zQ3shtxV1FrJfhqE1dvxYRcCknWNjHc3c5X1y3ZSoPDi2aur3'
    const blocks = await Promise.all(
      range(10).map((num) => dataToCborBlock({ my: `block-${num}` })),
    )
    const commits = await Promise.all(
      range(2).map((num) => dataToCborBlock({ my: `commit-${num}` })),
    )
    const blocks0 = new BlockMap()
    blocks0.set(commits[0].cid, commits[0].bytes)
    blocks.slice(0, 5).forEach((block) => {
      blocks0.set(block.cid, block.bytes)
    })
    const blocks1 = new BlockMap()
    blocks1.set(commits[1].cid, commits[1].bytes)
    blocks.slice(5, 10).forEach((block) => {
      blocks1.set(block.cid, block.bytes)
    })
    const toRemoveList = blocks0
      .entries()
      .slice(0, 2)
      .map((b) => b.cid)
    const toRemove = new CidSet(toRemoveList)
    await db.transaction(async (dbTxn) => {
      const storage = new SqlRepoStorage(dbTxn, did)
      await storage.applyCommit({
        cid: commits[0].cid,
        rev: TID.nextStr(),
        prev: null,
        newBlocks: blocks0,
        removedCids: new CidSet(),
      })
      await storage.applyCommit({
        cid: commits[1].cid,
        prev: commits[0].cid,
        rev: TID.nextStr(),
        newBlocks: blocks1,
        removedCids: toRemove,
      })
    })

    const storage = new SqlRepoStorage(db, did)
    const head = await storage.getRoot()
    if (!head) {
      throw new Error('could not get repo head')
    }
    expect(head.toString()).toEqual(commits[1].cid.toString())

    const cidsRes = await db.db
      .selectFrom('ipld_block')
      .where('creator', '=', did)
      .select('cid')
      .execute()
    const allCids = new CidSet(cidsRes.map((row) => CID.parse(row.cid)))
    for (const entry of blocks1.entries()) {
      expect(allCids.has(entry.cid)).toBe(true)
    }
    for (const entry of blocks0.entries()) {
      const shouldHave = !toRemove.has(entry.cid)
      expect(allCids.has(entry.cid)).toBe(shouldHave)
    }
  })
})
