import {
  hydration,
  presentation,
  skeleton,
} from '../../src/api/app/sokaa/actor/searchActors'
import { Hydrator } from '../../src/hydration/hydrator'
import { Views } from '../../src/views'
import { CdnUriBuilder } from '../../src/views/uri'
import {
  createRouteHandlers,
  createTestDb,
  seedActor,
} from '../dataplane/helpers'

describe('searchActors pipeline', () => {
  const schema = 'sokaa_appview_api_search_actors'
  let database: Awaited<ReturnType<typeof createTestDb>>
  let routes: ReturnType<typeof createRouteHandlers>
  let hydrator: Hydrator
  let views: Views

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

  it('prefix-matches handle/displayName and excludes suspended actors', async () => {
    const hydrateCtx = hydrator.createContext({ viewer: 'did:plc:alice' })
    const ctx = { hydrator, views, dataplane: hydrator.dataplane }

    const skel = await skeleton({
      ctx,
      params: { q: 'bo', limit: 10, hydrateCtx },
    })
    expect(skel.dids).toEqual(['did:plc:bob'])

    const byName = await skeleton({
      ctx,
      params: { q: 'Alice', limit: 10, hydrateCtx },
    })
    expect(byName.dids).toEqual(['did:plc:alice'])

    const suspended = await skeleton({
      ctx,
      params: { q: 'carol', limit: 10, hydrateCtx },
    })
    expect(suspended.dids).toEqual([])

    const state = await hydration({
      ctx,
      params: { q: 'bo', limit: 10, hydrateCtx },
      skeleton: skel,
    })
    const result = presentation({ ctx, skeleton: skel, hydration: state })
    expect(result.actors).toHaveLength(1)
    expect(result.actors[0]?.handle).toBe('bob.test')
  })
})
