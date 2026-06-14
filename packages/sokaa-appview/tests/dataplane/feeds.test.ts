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

  it('defaults limit when proto3 sends 0', async () => {
    const res = await routes.getTimeline!({ actorDid: alice, limit: 0 })
    expect(res.items.length).toBeGreaterThan(0)
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

describe('dataplane timeline pagination', () => {
  const schema = 'sokaa_appview_dataplane_timeline_pagination'
  let database: Awaited<ReturnType<typeof createTestDb>>
  let routes: ReturnType<typeof createRouteHandlers>

  beforeAll(async () => {
    database = await createTestDb(schema)
    routes = createRouteHandlers(database)
    await seedActor(database, { did: alice })
    await seedActor(database, { did: bob })
    await seedFollow(database, {
      creator: alice,
      subjectDid: bob,
      rkey: 'follow-bob',
    })
    const bobPosts = [
      { rkey: 'bob-4', createdAt: '2026-01-06T00:00:00.000Z' },
      { rkey: 'bob-3', createdAt: '2026-01-05T00:00:00.000Z' },
      { rkey: 'bob-2', createdAt: '2026-01-04T00:00:00.000Z' },
      { rkey: 'bob-1', createdAt: '2026-01-03T00:00:00.000Z' },
    ]
    for (const post of bobPosts) {
      await seedPost(database, { did: bob, ...post })
    }
    await seedPost(database, {
      did: alice,
      rkey: 'alice-2',
      createdAt: '2026-01-02T00:00:00.000Z',
    })
    await seedPost(database, {
      did: alice,
      rkey: 'alice-1',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
  })

  afterAll(async () => {
    await database.db.schema.dropSchema(schema).ifExists().cascade().execute()
    await database.close()
  })

  it('paginates timeline across dual-query merge without duplicates', async () => {
    const collected: { uri: string; createdAt: string }[] = []
    let cursor: string | undefined

    for (let page = 0; page < 3; page++) {
      const res = await routes.getTimeline!({
        actorDid: alice,
        limit: 2,
        cursor,
      })
      expect(res.items).toHaveLength(2)
      expect(res.cursor).toBeTruthy()

      for (const item of res.items) {
        const row = await database.db
          .selectFrom('post')
          .where('uri', '=', item.uri)
          .select(['createdAt'])
          .executeTakeFirstOrThrow()
        collected.push({ uri: item.uri, createdAt: row.createdAt })
      }
      cursor = res.cursor
    }

    expect(new Set(collected.map((item) => item.uri)).size).toBe(6)
    for (let i = 1; i < collected.length; i++) {
      expect(collected[i - 1].createdAt >= collected[i].createdAt).toBe(true)
    }

    const finalPage = await routes.getTimeline!({
      actorDid: alice,
      limit: 2,
      cursor,
    })
    expect(finalPage.items).toHaveLength(0)
    expect(finalPage.cursor).toBeUndefined()
  })
})
