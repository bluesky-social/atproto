import { ids } from '../../src/data-plane/server/indexing/collections'
import {
  createRouteHandlers,
  createTestDb,
  seedActor,
  seedFollow,
  seedPost,
} from './helpers'

const alice = 'did:plc:alice'
const bob = 'did:plc:bob'
const carol = 'did:plc:carol'

describe('dataplane feeds', () => {
  const schema = 'sokaa_appview_dataplane_feeds'
  let database: Awaited<ReturnType<typeof createTestDb>>
  let routes: ReturnType<typeof createRouteHandlers>

  beforeAll(async () => {
    database = await createTestDb(schema)
    routes = createRouteHandlers(database)
    await seedActor(database, { did: alice, handle: 'alice.test' })
    await seedActor(database, { did: bob, handle: 'bob.test' })
    await seedActor(database, { did: carol, handle: 'carol.test' })
    await seedFollow(database, {
      creator: alice,
      subjectDid: bob,
      rkey: 'follow-bob',
    })
    await seedPost(database, {
      did: bob,
      rkey: 'post-bob',
      createdAt: '2026-01-03T00:00:00.000Z',
      caption: 'bob post',
    })
    await seedPost(database, {
      did: carol,
      rkey: 'post-carol',
      createdAt: '2026-01-04T00:00:00.000Z',
      caption: 'carol post',
    })
    await seedPost(database, {
      did: alice,
      rkey: 'post-alice',
      createdAt: '2026-01-02T00:00:00.000Z',
      caption: 'alice post',
    })
  })

  afterAll(async () => {
    await database.db.schema.dropSchema(schema).ifExists().cascade().execute()
    await database.close()
  })

  it('getTimeline returns followed authors posts and own posts newest-first', async () => {
    const res = await routes.getTimeline!({
      actorDid: alice,
      limit: 10,
    })
    expect(res.items.map((item) => item.uri)).toEqual([
      `at://${bob}/${ids.AppSokaaFeedPost}/post-bob`,
      `at://${alice}/${ids.AppSokaaFeedPost}/post-alice`,
    ])
  })

  it('getTimeline excludes posts from unfollowed authors', async () => {
    const uris = (await routes.getTimeline!({ actorDid: alice, limit: 10 }))
      .items
    expect(uris.some((item) => item.uri.endsWith('/post-carol'))).toBe(false)
  })

  it('getAuthorFeed returns only the requested actor posts', async () => {
    const res = await routes.getAuthorFeed!({
      actorDid: bob,
      limit: 10,
    })
    expect(res.items).toHaveLength(1)
    expect(res.items[0]?.uri).toBe(
      `at://${bob}/${ids.AppSokaaFeedPost}/post-bob`,
    )
  })

  it('paginates author feed with stable ordering', async () => {
    await seedPost(database, {
      did: bob,
      rkey: 'post-bob-2',
      createdAt: '2026-01-05T00:00:00.000Z',
    })
    await seedPost(database, {
      did: bob,
      rkey: 'post-bob-3',
      createdAt: '2026-01-06T00:00:00.000Z',
    })

    const page1 = await routes.getAuthorFeed!({
      actorDid: bob,
      limit: 2,
    })
    expect(page1.items).toHaveLength(2)
    expect(page1.cursor).toBeTruthy()

    const page2 = await routes.getAuthorFeed!({
      actorDid: bob,
      limit: 2,
      cursor: page1.cursor,
    })
    expect(page2.items).toHaveLength(1)
    expect(new Set([...page1.items, ...page2.items]).size).toBe(3)
  })
})
