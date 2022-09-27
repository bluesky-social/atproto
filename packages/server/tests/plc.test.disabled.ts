import { MemoryBlockstore } from '@adxp/repo'
import { setupServerIdentity } from '../scripts/identity'
import { Database, ServerConfig } from '../src'
import runServer from '../src'
import * as util from './_util'

describe('plc integration', () => {
  let close: util.CloseFn

  beforeAll(async () => {
    const port = 2583
    const ownUrl = `http://localhost:${port}`
    const serverId = await setupServerIdentity(
      'http://localhost:2582',
      'bsky',
      ownUrl,
    )
    const db = await Database.memory()
    const serverBlockstore = new MemoryBlockstore()
    console.log('before server')
    const s = runServer(
      serverBlockstore,
      db,
      serverId.keypair,
      new ServerConfig({
        debugMode: true,
        scheme: 'http',
        hostname: 'localhost',
        port,
        didPlcUrl: 'http://localhost:2582',
        serverDid: serverId.did,
        jwtSecret: 'jwt-secret',
      }),
    )

    console.log('after server')

    close = async () => {
      await db.close()
      s.close()
    }
  })

  afterAll(async () => {
    await close()
  })

  it('blah', async () => {
    expect(true).toBeTruthy()
  })
})
