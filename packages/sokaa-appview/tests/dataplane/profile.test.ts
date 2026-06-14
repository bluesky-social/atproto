import { createRouteHandlers, createTestDb, seedActor } from './helpers'

const alice = 'did:plc:alice'
const missing = 'did:plc:missing'

describe('dataplane profile', () => {
  const schema = 'sokaa_appview_dataplane_profile'
  let database: Awaited<ReturnType<typeof createTestDb>>
  let routes: ReturnType<typeof createRouteHandlers>

  beforeAll(async () => {
    database = await createTestDb(schema)
    routes = createRouteHandlers(database)
    await seedActor(database, {
      did: alice,
      handle: 'alice.test',
      displayName: 'Alice',
      followersCount: 3,
      postsCount: 7,
    })
  })

  afterAll(async () => {
    await database.db.schema.dropSchema(schema).ifExists().cascade().execute()
    await database.close()
  })

  it('getActors returns actor rows in request order', async () => {
    const res = await routes.getActors!({ dids: [missing, alice] })
    expect(res.actors).toHaveLength(2)
    expect(res.actors[0]?.exists).toBe(false)
    expect(res.actors[1]).toMatchObject({
      exists: true,
      handle: 'alice.test',
      displayName: 'Alice',
      followersCount: 3,
      postsCount: 7,
      upstreamStatus: 'active',
    })
  })

  it('getActors returns empty for no dids', async () => {
    const res = await routes.getActors!({ dids: [] })
    expect(res.actors).toEqual([])
  })
})
