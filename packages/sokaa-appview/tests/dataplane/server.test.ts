import { createDataPlaneClient } from '../../src/data-plane/client'
import { DataPlaneServer } from '../../src/data-plane/server/dataplane-server'
import { createTestDb, seedActor, seedPost } from './helpers'

describe('dataplane server', () => {
  const schema = 'sokaa_appview_dataplane_server'
  let database: Awaited<ReturnType<typeof createTestDb>>
  let server: DataPlaneServer

  beforeAll(async () => {
    database = await createTestDb(schema)
    server = await DataPlaneServer.create(database, 0)
    await seedActor(database, { did: 'did:plc:alice', handle: 'alice.test' })
    await seedPost(database, {
      did: 'did:plc:alice',
      rkey: 'post-1',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
  })

  afterAll(async () => {
    await server.destroy()
    await database.db.schema.dropSchema(schema).ifExists().cascade().execute()
    await database.close()
  })

  it('serves ping and getAuthorFeed over ConnectRPC', async () => {
    const client = createDataPlaneClient(server.url)
    await expect(client.ping({})).resolves.toEqual({})
    const feed = await client.getAuthorFeed({
      actorDid: 'did:plc:alice',
      limit: 10,
    })
    expect(feed.items).toHaveLength(1)
  })
})
