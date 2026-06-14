import { ids } from '../../src/data-plane/server/indexing/collections'
import {
  createRouteHandlers,
  createTestDb,
  seedActor,
  seedFollow,
  seedLike,
  seedPost,
} from './helpers'

const alice = 'did:plc:alice'
const bob = 'did:plc:bob'

describe('dataplane bulk fetch', () => {
  const schema = 'sokaa_appview_dataplane_bulk'
  let database: Awaited<ReturnType<typeof createTestDb>>
  let routes: ReturnType<typeof createRouteHandlers>
  let bobPostUri: string

  beforeAll(async () => {
    database = await createTestDb(schema)
    routes = createRouteHandlers(database)
    await seedActor(database, { did: alice })
    await seedActor(database, { did: bob })
    bobPostUri = await seedPost(database, {
      did: bob,
      rkey: 'post-bob',
      createdAt: '2026-01-01T00:00:00.000Z',
      caption: 'hello',
      likeCount: 2,
    })
    await seedFollow(database, {
      creator: alice,
      subjectDid: bob,
      rkey: 'follow-bob',
    })
    await seedLike(database, {
      creator: alice,
      subjectUri: bobPostUri,
      rkey: 'like-bob-post',
    })
  })

  afterAll(async () => {
    await database.db.schema.dropSchema(schema).ifExists().cascade().execute()
    await database.close()
  })

  it('getPosts returns rows by uri with empty slots for missing posts', async () => {
    const missing = `at://${bob}/${ids.AppSokaaFeedPost}/missing`
    const res = await routes.getPosts!({ uris: [missing, bobPostUri] })
    expect(res.posts).toHaveLength(2)
    expect(res.posts[0]?.exists).toBe(false)
    expect(res.posts[1]).toMatchObject({
      exists: true,
      uri: bobPostUri,
      creator: bob,
      caption: 'hello',
      likeCount: 2,
    })
  })

  it('getLikesByActorAndSubjects returns like uris aligned to refs', async () => {
    const res = await routes.getLikesByActorAndSubjects!({
      actorDid: alice,
      refs: [
        { uri: bobPostUri, cid: 'bafy' },
        { uri: 'at://missing', cid: '' },
      ],
    })
    expect(res.uris).toHaveLength(2)
    expect(res.uris[0]).toContain(`/${ids.AppSokaaFeedLike}/like-bob-post`)
    expect(res.uris[1]).toBe('')
  })

  it('getActorFollowsActors returns follow uris aligned to target dids', async () => {
    const res = await routes.getActorFollowsActors!({
      actorDid: alice,
      targetDids: [bob, 'did:plc:stranger'],
    })
    expect(res.uris).toHaveLength(2)
    expect(res.uris[0]).toContain(`/${ids.AppSokaaGraphFollow}/follow-bob`)
    expect(res.uris[1]).toBe('')
  })
})
