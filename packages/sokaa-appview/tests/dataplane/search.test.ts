import {
  createRouteHandlers,
  createTestDb,
  seedActor,
  seedPost,
} from './helpers'

describe('dataplane searchActors', () => {
  const schema = 'sokaa_appview_dataplane_search_actors'
  let database: Awaited<ReturnType<typeof createTestDb>>
  let routes: ReturnType<typeof createRouteHandlers>

  beforeAll(async () => {
    database = await createTestDb(schema)
    routes = createRouteHandlers(database)
    await seedActor(database, {
      did: 'did:plc:alice',
      handle: 'alice.test',
      displayName: 'Alice Wonder',
    })
    await seedActor(database, {
      did: 'did:plc:bob',
      handle: 'bob.test',
      displayName: 'Bob Builder',
    })
    await seedActor(database, {
      did: 'did:plc:carol',
      handle: 'carol.test',
      displayName: 'Carol',
      upstreamStatus: 'suspended',
    })
  })

  afterAll(async () => {
    await database.db.schema.dropSchema(schema).ifExists().cascade().execute()
    await database.close()
  })

  it('prefix-matches handle and displayName, strips @, excludes suspended', async () => {
    const byHandle = await routes.searchActors!({ term: '@bo', limit: 10 })
    expect(byHandle.dids).toEqual(['did:plc:bob'])

    const byName = await routes.searchActors!({ term: 'Alice', limit: 10 })
    expect(byName.dids).toEqual(['did:plc:alice'])

    const suspended = await routes.searchActors!({ term: 'carol', limit: 10 })
    expect(suspended.dids).toEqual([])

    const empty = await routes.searchActors!({ term: '   ', limit: 10 })
    expect(empty.dids).toEqual([])
  })
})

describe('dataplane getRecentFeed', () => {
  const schema = 'sokaa_appview_dataplane_recent_feed'
  let database: Awaited<ReturnType<typeof createTestDb>>
  let routes: ReturnType<typeof createRouteHandlers>
  let aliceUri: string
  let bobUri: string

  beforeAll(async () => {
    database = await createTestDb(schema)
    routes = createRouteHandlers(database)
    await seedActor(database, { did: 'did:plc:alice', handle: 'alice.test' })
    await seedActor(database, { did: 'did:plc:bob', handle: 'bob.test' })
    await seedActor(database, {
      did: 'did:plc:evil',
      handle: 'evil.test',
      upstreamStatus: 'takendown',
    })

    aliceUri = await seedPost(database, {
      did: 'did:plc:alice',
      rkey: 'a',
      createdAt: '2026-01-02T00:00:00.000Z',
    })
    bobUri = await seedPost(database, {
      did: 'did:plc:bob',
      rkey: 'b',
      createdAt: '2026-01-03T00:00:00.000Z',
    })
    await seedPost(database, {
      did: 'did:plc:evil',
      rkey: 'evil',
      createdAt: '2026-01-04T00:00:00.000Z',
    })
  })

  afterAll(async () => {
    await database.db.schema.dropSchema(schema).ifExists().cascade().execute()
    await database.close()
  })

  it('returns newest active posts and paginates', async () => {
    const page1 = await routes.getRecentFeed!({ limit: 1 })
    expect(page1.items.map((i) => i.uri)).toEqual([bobUri])
    expect(page1.cursor).toBeTruthy()

    const page2 = await routes.getRecentFeed!({
      limit: 1,
      cursor: page1.cursor,
    })
    expect(page2.items.map((i) => i.uri)).toEqual([aliceUri])
  })
})
