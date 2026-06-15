import {
  hydration,
  presentation,
  skeleton,
} from '../../src/api/app/sokaa/feed/getAuthorFeed'
import { ids } from '../../src/data-plane/server/indexing/collections'
import { Hydrator } from '../../src/hydration/hydrator'
import { Views } from '../../src/views'
import { CdnUriBuilder } from '../../src/views/uri'
import {
  createRouteHandlers,
  createTestDb,
  seedActor,
  seedPost,
} from '../dataplane/helpers'

const bob = 'did:plc:bob'

describe('getAuthorFeed pipeline', () => {
  const schema = 'sokaa_appview_api_author_feed'
  let database: Awaited<ReturnType<typeof createTestDb>>
  let routes: ReturnType<typeof createRouteHandlers>
  let hydrator: Hydrator
  let views: Views
  let postUris: string[]

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

    await seedActor(database, {
      did: bob,
      handle: 'bob.test',
      followersCount: 12,
      postsCount: 2,
    })
    postUris = [
      await seedPost(database, {
        did: bob,
        rkey: 'post-1',
        createdAt: '2026-01-03T00:00:00.000Z',
        caption: 'first',
      }),
      await seedPost(database, {
        did: bob,
        rkey: 'post-2',
        createdAt: '2026-01-02T00:00:00.000Z',
        caption: 'second',
      }),
    ]
  })

  afterAll(async () => {
    await database.db.schema.dropSchema(schema).ifExists().cascade().execute()
    await database.close()
  })

  it('returns lexicon feed shape with denormalized author counts', async () => {
    const hydrateCtx = hydrator.createContext({ viewer: null })
    const ctx = {
      hydrator,
      views,
      dataplane: hydrator.dataplane,
    }
    const params = { actor: bob, limit: 10, hydrateCtx }

    const skel = await skeleton({ ctx, params })
    expect(skel.items).toHaveLength(2)

    const state = await hydration({ ctx, params, skeleton: skel })
    const result = presentation({ ctx, skeleton: skel, hydration: state })

    expect(result.feed).toHaveLength(2)
    expect(result.feed[0].post.uri).toBe(postUris[0])
    expect(result.feed[0].post.author.did).toBe(bob)
    expect(result.feed[0].post.author.followersCount).toBeUndefined()
    expect(result.feed[0].post.record.$type).toBe(ids.AppSokaaFeedPost)
    expect(result.feed[0].post.record.caption).toBe('first')
  })
})
