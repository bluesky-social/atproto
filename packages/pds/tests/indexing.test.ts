import AtpAgent, { AppBskyActorProfile, AppBskyFeedPost } from '@atproto/api'
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
    const { db, services, messageQueue } = server.ctx
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
    const updateRecord = await prepareUpdate({
      did: sc.dids.alice,
      collection: ids.AppBskyFeedPost,
      rkey: uri.rkey,
      record: {
        $type: ids.AppBskyFeedPost,
        text: '@carol.test how are you?',
        facets: [
          {
            index: { byteStart: 0, byteEnd: 11 },
            features: [
              {
                $type: `${ids.AppBskyRichtextFacet}#mention`,
                did: sc.dids.carol,
              },
            ],
          },
        ],
        createdAt,
      } as AppBskyFeedPost.Record,
    })
    const deleteRecord = prepareDelete({
      did: sc.dids.alice,
      collection: ids.AppBskyFeedPost,
      rkey: uri.rkey,
    })

    // Create
    await db.transaction(async (tx) => {
      await services
        .repo(tx)
        .processWrites(sc.dids.alice, [createRecord], new Date().toISOString())
    })

    const getAfterCreate = await agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(forSnapshot(getAfterCreate.data)).toMatchSnapshot()
    await messageQueue.processAll()
    const createNotifications = await getNotifications(db, uri)

    // Update
    await db.transaction(async (tx) => {
      await services
        .repo(tx)
        .processWrites(sc.dids.alice, [updateRecord], new Date().toISOString())
    })

    const getAfterUpdate = await agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(forSnapshot(getAfterUpdate.data)).toMatchSnapshot()
    await messageQueue.processAll()
    const updateNotifications = await getNotifications(db, uri)

    // Delete
    await db.transaction(async (tx) => {
      await services
        .repo(tx)
        .processWrites(sc.dids.alice, [deleteRecord], new Date().toISOString())
    })

    const getAfterDelete = agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    await expect(getAfterDelete).rejects.toThrow(/Post not found:/)
    await messageQueue.processAll()
    const deleteNotifications = await getNotifications(db, uri)

    expect(
      forSnapshot({
        createNotifications,
        updateNotifications,
        deleteNotifications,
      }),
    ).toMatchSnapshot()
  })

  it('indexes profiles.', async () => {
    const { db, services, messageQueue } = server.ctx
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
    await db.transaction(async (tx) => {
      await services
        .repo(tx)
        .processWrites(sc.dids.dan, [createRecord], new Date().toISOString())
    })

    const getAfterCreate = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(forSnapshot(getAfterCreate.data)).toMatchSnapshot()
    await messageQueue.processAll()
    const createNotifications = await getNotifications(db, uri)

    // Update
    await db.transaction(async (tx) => {
      await services
        .repo(tx)
        .processWrites(sc.dids.dan, [updateRecord], new Date().toISOString())
    })

    const getAfterUpdate = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(forSnapshot(getAfterUpdate.data)).toMatchSnapshot()
    await messageQueue.processAll()
    const updateNotifications = await getNotifications(db, uri)

    // Delete
    await db.transaction(async (tx) => {
      await services
        .repo(tx)
        .processWrites(sc.dids.dan, [deleteRecord], new Date().toISOString())
    })

    const getAfterDelete = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(forSnapshot(getAfterDelete.data)).toMatchSnapshot()
    await messageQueue.processAll()
    const deleteNotifications = await getNotifications(db, uri)

    expect(
      forSnapshot({
        createNotifications,
        updateNotifications,
        deleteNotifications,
      }),
    ).toMatchSnapshot()
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
