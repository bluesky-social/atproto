import {
  hydration,
  presentation,
  skeleton,
} from '../../src/api/app/sokaa/feed/getRecentFeed'
import { Hydrator } from '../../src/hydration/hydrator'
import { Views } from '../../src/views'
import { CdnUriBuilder } from '../../src/views/uri'
import {
  createRouteHandlers,
  createTestDb,
  seedActor,
  seedPost,
} from '../dataplane/helpers'

describe('getRecentFeed pipeline', () => {
  const schema = 'sokaa_appview_api_recent_feed'
  let database: Awaited<ReturnType<typeof createTestDb>>
  let routes: ReturnType<typeof createRouteHandlers>
  let hydrator: Hydrator
  let views: Views
  let alicePostUri: string
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
        getRecentFeed: (req) => routes.getRecentFeed!(req),
        searchActors: (req) => routes.searchActors!(req),
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

    await seedActor(database, { did: 'did:plc:alice', handle: 'alice.test' })
    await seedActor(database, { did: 'did:plc:bob', handle: 'bob.test' })
    await seedActor(database, {
      did: 'did:plc:evil',
      handle: 'evil.test',
      upstreamStatus: 'takendown',
    })

    alicePostUri = await seedPost(database, {
      did: 'did:plc:alice',
      rkey: 'post-a',
      createdAt: '2026-01-02T00:00:00.000Z',
      caption: 'alice',
    })
    bobPostUri = await seedPost(database, {
      did: 'did:plc:bob',
      rkey: 'post-b',
      createdAt: '2026-01-03T00:00:00.000Z',
      caption: 'bob',
    })
    await seedPost(database, {
      did: 'did:plc:evil',
      rkey: 'post-evil',
      createdAt: '2026-01-04T00:00:00.000Z',
      caption: 'evil',
    })
  })

  afterAll(async () => {
    await database.db.schema.dropSchema(schema).ifExists().cascade().execute()
    await database.close()
  })

  it('returns newest active posts and excludes takendown authors', async () => {
    const hydrateCtx = hydrator.createContext({ viewer: null })
    const ctx = { hydrator, views, dataplane: hydrator.dataplane }

    const skel = await skeleton({
      ctx,
      params: { limit: 10, hydrateCtx },
    })
    const uris = skel.items.map((item) => item.post.uri)
    expect(uris).toEqual([bobPostUri, alicePostUri])

    const state = await hydration({
      ctx,
      params: { limit: 10, hydrateCtx },
      skeleton: skel,
    })
    const result = presentation({ ctx, skeleton: skel, hydration: state })
    expect(result.feed).toHaveLength(2)
    expect(result.feed[0]?.post.uri).toBe(bobPostUri)
  })
})
