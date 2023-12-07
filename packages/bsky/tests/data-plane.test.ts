import { DataPlaneServer } from '../src/data-plane/server'
import {
  createDataPlaneClient,
  DataPlaneClient,
} from '../src/data-plane/client'

describe('data plane', () => {
  let server: DataPlaneServer
  let client: DataPlaneClient

  beforeAll(async () => {
    server = await DataPlaneServer.create(1337)
    client = createDataPlaneClient('http://localhost:1337', '1.1')
  })

  afterAll(async () => {
    await server.stop()
  })

  it('works', async () => {
    const res = await client.getFollowers({ actorDid: 'did:example:test' })
    expect(res.uris).toEqual(['did:example:test'])
    expect(res.cursor).toEqual('test-cursor')
  })
})
