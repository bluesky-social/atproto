import SqlBlockstore from '../src/sql-blockstore'
import { CloseFn, runTestServer, TestServerInfo } from './_util'
import * as locals from '../src/locals'

describe('sql blockstore', () => {
  let server: TestServerInfo
  let close: CloseFn

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'sql_blockstore',
    })
    close = server.close
  })

  afterAll(async () => {
    await close()
  })

  it('puts and gets blocks.', async () => {
    const { db } = locals.get(server.app)
    const did = 'did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme'

    const cid = await db.transaction((dbTxn) => {
      const blockstore = new SqlBlockstore(dbTxn, did)
      return blockstore.put({ my: 'block' })
    })

    const blockstore = new SqlBlockstore(db, did)
    const value = await blockstore.getUnchecked(cid)

    expect(value).toEqual({ my: 'block' })
  })

  it('allows same content to be put multiple times by the same did.', async () => {
    const { db } = locals.get(server.app)
    const did = 'did:key:zQ3shtxV1FrJfhqE1dvxYRcCknWNjHc3c5X1y3ZSoPDi2aur2'

    const cidA = await db.transaction((dbTxn) => {
      const blockstore = new SqlBlockstore(dbTxn, did)
      return blockstore.put({ my: 'block' })
    })

    const cidB = await db.transaction((dbTxn) => {
      const blockstore = new SqlBlockstore(dbTxn, did)
      return blockstore.put({ my: 'block' })
    })

    expect(cidA.equals(cidB)).toBe(true)
  })
})
