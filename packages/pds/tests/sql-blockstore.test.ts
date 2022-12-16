import { Database } from '../src'
import SqlBlockstore from '../src/sql-blockstore'
import { CloseFn, runTestServer } from './_util'

describe('sql blockstore', () => {
  let db: Database
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'sql_blockstore',
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
      const blockstore = new SqlBlockstore(dbTxn, did)
      const cid = await blockstore.stage({ my: 'block' })
      await blockstore.saveStaged()
      return cid
    })

    const blockstore = new SqlBlockstore(db, did)
    const value = await blockstore.getUnchecked(cid)

    expect(value).toEqual({ my: 'block' })
  })

  it('allows same content to be put multiple times by the same did.', async () => {
    const did = 'did:key:zQ3shtxV1FrJfhqE1dvxYRcCknWNjHc3c5X1y3ZSoPDi2aur2'

    const cidA = await db.transaction(async (dbTxn) => {
      const blockstore = new SqlBlockstore(dbTxn, did)
      const cid = await blockstore.stage({ my: 'block' })
      await blockstore.saveStaged()
      return cid
    })

    const cidB = await db.transaction(async (dbTxn) => {
      const blockstore = new SqlBlockstore(dbTxn, did)
      const cid = await blockstore.stage({ my: 'block' })
      await blockstore.saveStaged()
      return cid
    })

    expect(cidA.equals(cidB)).toBe(true)
  })
})
