import { range, dataToCborBlock } from '@atproto/common'
import { def } from '@atproto/repo'
import BlockMap from '@atproto/repo/src/block-map'
import { Database } from '../src'
import SqlRepoStorage from '../src/sql-repo-storage'
import { CloseFn, runTestServer } from './_util'

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
    await db.transaction(async (dbTxn) => {
      const storage = new SqlRepoStorage(dbTxn, did)
      await storage.applyCommit({
        commit: commits[0].cid,
        prev: null,
        blocks: blocks0,
      })
      await storage.applyCommit({
        commit: commits[1].cid,
        prev: commits[0].cid,
        blocks: blocks1,
      })
    })

    const storage = new SqlRepoStorage(db, did)
    const head = await storage.getHead()
    if (!head) {
      throw new Error('could not get repo head')
    }
    expect(head.toString()).toEqual(commits[1].cid.toString())
    const commitPath = await storage.getCommitPath(head, null)
    if (!commitPath) {
      throw new Error('could not get commit path')
    }
    expect(commitPath.length).toBe(2)
    expect(commitPath[0].equals(commits[0].cid)).toBeTruthy()
    expect(commitPath[1].equals(commits[1].cid)).toBeTruthy()
    const commitData = await storage.getCommits(head, null)
    if (!commitData) {
      throw new Error('could not get commit data')
    }
    expect(commitData.length).toBe(2)
    expect(commitData[0].commit.equals(commits[0].cid)).toBeTruthy()
    expect(commitData[0].blocks.equals(blocks0)).toBeTruthy()
    expect(commitData[1].commit.equals(commits[1].cid)).toBeTruthy()
    expect(commitData[1].blocks.equals(blocks1)).toBeTruthy()
  })
})
