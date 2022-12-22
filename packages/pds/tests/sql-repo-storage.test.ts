import { valueToIpldBlock } from '@atproto/common'
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
      const block = await valueToIpldBlock({ my: 'block' })
      await storage.putBlock(block.cid, block.bytes)
      return block.cid
    })

    const storage = new SqlRepoStorage(db, did)
    const value = await storage.getUnchecked(cid)

    expect(value).toEqual({ my: 'block' })
  })

  it('allows same content to be put multiple times by the same did.', async () => {
    const did = 'did:key:zQ3shtxV1FrJfhqE1dvxYRcCknWNjHc3c5X1y3ZSoPDi2aur2'

    const cidA = await db.transaction(async (dbTxn) => {
      const storage = new SqlRepoStorage(dbTxn, did)
      const block = await valueToIpldBlock({ my: 'block' })
      await storage.putBlock(block.cid, block.bytes)
      return block.cid
    })

    const cidB = await db.transaction(async (dbTxn) => {
      const storage = new SqlRepoStorage(dbTxn, did)
      const block = await valueToIpldBlock({ my: 'block' })
      await storage.putBlock(block.cid, block.bytes)
      return block.cid
    })

    expect(cidA.equals(cidB)).toBe(true)
  })
})
