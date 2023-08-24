import AtpAgent, {
  AppBskyActorProfile,
  AppBskyFeedPost,
  AppBskyFeedLike,
  AppBskyFeedRepost,
} from '@atproto/api'
import { AtUri } from '@atproto/uri'
import { CloseFn, forSnapshot, runTestServer, TestServerInfo } from './_util'
import { SeedClient } from './seeds/client'
import usersSeed from './seeds/users'
import { Database } from '../src'
import { prepareCreate, prepareDelete, prepareUpdate } from '../src/repo'
import { ids } from '../src/lexicon/lexicons'

describe('indexing', () => {
  let server: TestServerInfo
  let close: CloseFn
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'indexing',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await usersSeed(sc)
  })

  afterAll(async () => {
    await close()
  })

  it('indexes posts.', async () => {
    const { db, services } = server.ctx
    const createdAt = new Date().toISOString()
    const createRecord = await prepareCreate({
      did: sc.dids.alice,
      collection: ids.AppBskyFeedPost,
      record: {
        $type: ids.AppBskyFeedPost,
        text: '@bob.test how are you?',
        facets: [
          {
            index: { byteStart: 0, byteEnd: 9 },
            features: [
              {
                $type: `${ids.AppBskyRichtextFacet}#mention`,
                did: sc.dids.bob,
              },
            ],
          },
        ],
        createdAt,
      } as AppBskyFeedPost.Record,
    })
    const { uri } = createRecord
    const deleteRecord = prepareDelete({
      did: sc.dids.alice,
      collection: ids.AppBskyFeedPost,
      rkey: uri.rkey,
    })

    // Create
    await services
      .repo(db)
      .processWrites({ did: sc.dids.alice, writes: [createRecord] }, 1)
    await server.processAll()

    const getAfterCreate = await agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(forSnapshot(getAfterCreate.data)).toMatchSnapshot()
    const createNotifications = await getNotifications(db, uri)

    // Delete
    await services
      .repo(db)
      .processWrites({ did: sc.dids.alice, writes: [deleteRecord] }, 1)
    await server.processAll()

    const getAfterDelete = agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    await expect(getAfterDelete).rejects.toThrow(/Post not found:/)
    const deleteNotifications = await getNotifications(db, uri)

    expect(
      forSnapshot({
        createNotifications,
        deleteNotifications,
      }),
    ).toMatchSnapshot()
  })

  it('indexes profiles.', async () => {
    const { db, services } = server.ctx
    const createRecord = await prepareCreate({
      did: sc.dids.dan,
      collection: ids.AppBskyActorProfile,
      rkey: 'self',
      record: {
        $type: ids.AppBskyActorProfile,
        displayName: 'dan',
      } as AppBskyActorProfile.Record,
    })
    const { uri } = createRecord
    const updateRecord = await prepareUpdate({
      did: sc.dids.dan,
      collection: ids.AppBskyActorProfile,
      rkey: uri.rkey,
      record: {
        $type: ids.AppBskyActorProfile,
        displayName: 'danny',
      } as AppBskyActorProfile.Record,
    })
    const deleteRecord = prepareDelete({
      did: sc.dids.dan,
      collection: ids.AppBskyActorProfile,
      rkey: uri.rkey,
    })

    // Create
    await services
      .repo(db)
      .processWrites({ did: sc.dids.dan, writes: [createRecord] }, 1)
    await server.processAll()

    const getAfterCreate = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(forSnapshot(getAfterCreate.data)).toMatchSnapshot()
    const createNotifications = await getNotifications(db, uri)

    // Update
    await services
      .repo(db)
      .processWrites({ did: sc.dids.dan, writes: [updateRecord] }, 1)
    await server.processAll()

    const getAfterUpdate = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(forSnapshot(getAfterUpdate.data)).toMatchSnapshot()
    const updateNotifications = await getNotifications(db, uri)

    // Delete
    await services
      .repo(db)
      .processWrites({ did: sc.dids.dan, writes: [deleteRecord] }, 1)
    await server.processAll()

    const getAfterDelete = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(forSnapshot(getAfterDelete.data)).toMatchSnapshot()
    const deleteNotifications = await getNotifications(db, uri)

    expect(
      forSnapshot({
        createNotifications,
        updateNotifications,
        deleteNotifications,
      }),
    ).toMatchSnapshot()
  })

  it('does not notify user of own like or repost', async () => {
    const { db, services } = server.ctx
    const createdAt = new Date().toISOString()

    const originalPost = await prepareCreate({
      did: sc.dids.bob,
      collection: ids.AppBskyFeedPost,
      record: {
        $type: ids.AppBskyFeedPost,
        text: 'original post',
        createdAt,
      } as AppBskyFeedPost.Record,
    })

    const originalPostRef = {
      uri: originalPost.uri.toString(),
      cid: originalPost.cid.toString(),
    }

    // own actions
    const ownLike = await prepareCreate({
      did: sc.dids.bob,
      collection: ids.AppBskyFeedLike,
      record: {
        $type: ids.AppBskyFeedLike,
        subject: originalPostRef,
        createdAt,
      } as AppBskyFeedLike.Record,
    })
    const ownRepost = await prepareCreate({
      did: sc.dids.bob,
      collection: ids.AppBskyFeedRepost,
      record: {
        $type: ids.AppBskyFeedRepost,
        subject: originalPostRef,
        createdAt,
      } as AppBskyFeedRepost.Record,
    })

    // other actions
    const aliceLike = await prepareCreate({
      did: sc.dids.alice,
      collection: ids.AppBskyFeedLike,
      record: {
        $type: ids.AppBskyFeedLike,
        subject: originalPostRef,
        createdAt,
      } as AppBskyFeedLike.Record,
    })
    const aliceRepost = await prepareCreate({
      did: sc.dids.alice,
      collection: ids.AppBskyFeedRepost,
      record: {
        $type: ids.AppBskyFeedRepost,
        subject: originalPostRef,
        createdAt,
      } as AppBskyFeedRepost.Record,
    })

    await services.repo(db).processWrites(
      {
        did: sc.dids.bob,
        writes: [originalPost, ownLike, ownRepost],
      },
      1,
    )
    await services.repo(db).processWrites(
      {
        did: sc.dids.alice,
        writes: [aliceLike, aliceRepost],
      },
      1,
    )

    await server.processAll()

    const {
      data: { notifications },
    } = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: sc.getHeaders(sc.dids.bob) },
    )

    expect(notifications).toHaveLength(2)
    expect(
      notifications.every((n) => {
        return n.author.did !== sc.dids.bob
      }),
    ).toBeTruthy()

    // Cleanup
    const del = (uri: AtUri) => {
      return prepareDelete({
        did: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
      })
    }

    // Delete
    await services.repo(db).processWrites(
      {
        did: sc.dids.bob,
        writes: [del(originalPost.uri), del(ownLike.uri), del(ownRepost.uri)],
      },
      1,
    )
    await services.repo(db).processWrites(
      {
        did: sc.dids.alice,
        writes: [del(aliceLike.uri), del(aliceRepost.uri)],
      },
      1,
    )
    await server.processAll()
  })

  async function getNotifications(db: Database, uri: AtUri) {
    return await db.db
      .selectFrom('user_notification')
      .selectAll()
      .where('recordUri', '=', uri.toString())
      .orderBy('indexedAt')
      .execute()
  }
})
