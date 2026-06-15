import {
  hydration,
  presentation,
  skeleton,
} from '../../src/api/app/sokaa/feed/getTimeline'
import { ids } from '../../src/data-plane/server/indexing/collections'
import { Hydrator } from '../../src/hydration/hydrator'
import { Views } from '../../src/views'
import { CdnUriBuilder } from '../../src/views/uri'
import {
  createRouteHandlers,
  createTestDb,
  seedActor,
  seedFollow,
  seedLike,
  seedPost,
} from '../dataplane/helpers'

const alice = 'did:plc:alice'
const bob = 'did:plc:bob'
describe('getTimeline pipeline', () => {
  const schema = 'sokaa_appview_api_timeline'
  let database: Awaited<ReturnType<typeof createTestDb>>
  let routes: ReturnType<typeof createRouteHandlers>
  let hydrator: Hydrator
  let views: Views
  let bobPostUri: string

  beforeAll(async () => {
    database = await createTestDb(schema)
    routes = createRouteHandlers(database)
    hydrator = new Hydrator(
      {
        getTimeline: (req) => routes.getTimeline!(req),
        getPosts: (req) => routes.getPosts!(req),
        getActors: (req) => routes.getActors!(req),
        getLikesByActorAndSubjects: (req) =>
          routes.getLikesByActorAndSubjects!(req),
        getAuthorFeed: (req) => routes.getAuthorFeed!(req),
        getActorFollowsActors: (req) => routes.getActorFollowsActors!(req),
        ping: async () => ({}),
      },
      database,
    )
    views = new Views(
      new CdnUriBuilder({
        cdnUrl: 'https://cdn.test',
        videoPlaylistUrlPattern: 'https://cdn.test/vid/%s/%s/playlist.m3u8',
        videoThumbnailUrlPattern: 'https://cdn.test/vid/%s/%s/thumbnail.jpg',
      }),
    )

    await seedActor(database, { did: alice, handle: 'alice.test' })
    await seedActor(database, { did: bob, handle: 'bob.test' })
    await seedFollow(database, {
      creator: alice,
      subjectDid: bob,
      rkey: 'follow-bob',
    })
    bobPostUri = await seedPost(database, {
      did: bob,
      rkey: 'post-bob',
      createdAt: '2026-01-03T00:00:00.000Z',
      caption: 'bob post',
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

  it('hydrates timeline feed with viewer like state', async () => {
    const hydrateCtx = hydrator.createContext({ viewer: alice })
    const ctx = {
      hydrator,
      views,
      dataplane: hydrator.dataplane,
    }

    const skel = await skeleton({
      ctx,
      params: { limit: 10, hydrateCtx: { ...hydrateCtx, viewer: alice } },
    })
    expect(skel.items.some((item) => item.post.uri === bobPostUri)).toBe(true)

    const state = await hydration({
      ctx,
      params: { limit: 10, hydrateCtx },
      skeleton: skel,
    })
    const result = presentation({ ctx, skeleton: skel, hydration: state })

    const bobFeedItem = result.feed.find((item) => item.post.uri === bobPostUri)
    expect(bobFeedItem).toBeDefined()
    expect(bobFeedItem?.post.author.did).toBe(bob)
    expect(bobFeedItem?.post.viewer?.like).toContain(ids.AppSokaaFeedLike)
    expect(bobFeedItem?.post.record.$type).toBe(ids.AppSokaaFeedPost)
  })
})
