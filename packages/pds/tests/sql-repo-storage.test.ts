import { CID } from 'multiformats/cid'
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

  let currCommit: CID

  it('puts and gets blocks.', async () => {
    const did = 'did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme'

    const cid = await db.transaction(async (dbTxn) => {
      const storage = new SqlRepoStorage(dbTxn, did)
      const cid = await storage.stage({ my: 'block' })
      currCommit = await storage.stage({ my: 'commit' })
      await storage.commitStaged(currCommit, null)
      return cid
    })

    const storage = new SqlRepoStorage(db, did)
    const value = await storage.getUnchecked(cid)

    expect(value).toEqual({ my: 'block' })
  })

  it('allows same content to be put multiple times by the same did.', async () => {
    const did = 'did:key:zQ3shtxV1FrJfhqE1dvxYRcCknWNjHc3c5X1y3ZSoPDi2aur2'

    const cidA = await db.transaction(async (dbTxn) => {
      const storage = new SqlRepoStorage(dbTxn, did)
      const cid = await storage.stage({ my: 'block' })
      const commitCid = await storage.stage({ my: 'commit1' })
      await storage.commitStaged(commitCid, currCommit)
      currCommit = commitCid
      return cid
    })

    const cidB = await db.transaction(async (dbTxn) => {
      const storage = new SqlRepoStorage(dbTxn, did)
      const cid = await storage.stage({ my: 'block' })
      const commitCid = await storage.stage({ my: 'commit2' })
      await storage.commitStaged(commitCid, currCommit)
      currCommit = commitCid
      return cid
    })

    expect(cidA.equals(cidB)).toBe(true)
  })
})
