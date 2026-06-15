import {
  hydration,
  presentation,
  skeleton,
} from '../../src/api/app/sokaa/actor/getProfile'
import { Hydrator } from '../../src/hydration/hydrator'
import { Views } from '../../src/views'
import { CdnUriBuilder } from '../../src/views/uri'
import {
  createRouteHandlers,
  createTestDb,
  seedActor,
} from '../dataplane/helpers'

const bob = 'did:plc:bob'

describe('getProfile pipeline', () => {
  const schema = 'sokaa_appview_api_profile'
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
  })

  afterAll(async () => {
    await database.db.schema.dropSchema(schema).ifExists().cascade().execute()
    await database.close()
  })

  it('suppresses suspended actors without admin override', async () => {
    await seedActor(database, {
      did: bob,
      handle: 'bob.test',
      upstreamStatus: 'suspended',
      followersCount: 3,
      postsCount: 1,
    })

    const ctx = { hydrator, views }
    const hydrateCtx = hydrator.createContext({
      viewer: null,
      includeTakedowns: false,
    })
    const params = { actor: bob, hydrateCtx }

    const skel = await skeleton({ ctx, params })
    const state = await hydration({ ctx, params, skeleton: skel })

    expect(() =>
      presentation({ ctx, params, skeleton: skel, hydration: state }),
    ).toThrow('Account has been suspended')
  })

  it('returns suspended profile when includeTakedowns is set', async () => {
    const ctx = { hydrator, views }
    const hydrateCtx = hydrator.createContext({
      viewer: null,
      includeTakedowns: true,
    })
    const params = { actor: bob, hydrateCtx }

    const skel = await skeleton({ ctx, params })
    const state = await hydration({ ctx, params, skeleton: skel })
    const profile = presentation({
      ctx,
      params,
      skeleton: skel,
      hydration: state,
    })

    expect(profile.did).toBe(bob)
    expect(profile.followersCount).toBe(3)
    expect(profile.postsCount).toBe(1)
  })
})
