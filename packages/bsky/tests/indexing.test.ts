import { sql } from 'kysely'
import { CID } from 'multiformats/cid'
import { cidForCbor, TID } from '@atproto/common'
import * as pdsRepo from '@atproto/pds/src/repo/prepare'
import { WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import { Client } from '@did-plc/lib'
import AtpAgent, { AppBskyActorProfile, AppBskyFeedPost } from '@atproto/api'
import { CloseFn, runTestEnv, TestEnvInfo } from '@atproto/dev-env'
import { forSnapshot, processAll } from './_util'
import { SeedClient } from './seeds/client'
import usersSeed from './seeds/users'
import basicSeed from './seeds/basic'
import { ids } from '../src/lexicon/lexicons'
import { Database } from '../src/db'

describe('indexing', () => {
  let testEnv: TestEnvInfo
  let close: CloseFn
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'indexing',
    })
    close = testEnv.close
    agent = new AtpAgent({ service: testEnv.bsky.url })
    pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)
    await usersSeed(sc)
    // Data in tests is not processed from subscription
    await processAll(testEnv)
    await testEnv.bsky.sub.destroy()
  })

  afterAll(async () => {
    await close()
  })

  it('indexes posts.', async () => {
    const { db, services } = testEnv.bsky.ctx
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
    const [uri] = createRecord
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
      return await services.indexing(tx).indexRecord(...createRecord)
    })

    const getAfterCreate = await agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      { headers: sc.getHeaders(sc.dids.alice, true) },
    )
    expect(forSnapshot(getAfterCreate.data)).toMatchSnapshot()
    const createNotifications = await getNotifications(db, uri)

    // Update
    await db.transaction(async (tx) => {
      return await services.indexing(tx).indexRecord(...updateRecord)
    })

    const getAfterUpdate = await agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      { headers: sc.getHeaders(sc.dids.alice, true) },
    )
    expect(forSnapshot(getAfterUpdate.data)).toMatchSnapshot()
    const updateNotifications = await getNotifications(db, uri)

    // Delete
    await db.transaction(async (tx) => {
      return await services.indexing(tx).deleteRecord(...deleteRecord)
    })

    const getAfterDelete = agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      { headers: sc.getHeaders(sc.dids.alice, true) },
    )
    await expect(getAfterDelete).rejects.toThrow(/Post not found:/)
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
    const { db, services } = testEnv.bsky.ctx
    const createRecord = await prepareCreate({
      did: sc.dids.dan,
      collection: ids.AppBskyActorProfile,
      rkey: 'self',
      record: {
        $type: ids.AppBskyActorProfile,
        displayName: 'dan',
      } as AppBskyActorProfile.Record,
    })
    const [uri] = createRecord
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
      return await services.indexing(tx).indexRecord(...createRecord)
    })

    const getAfterCreate = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(sc.dids.alice, true) },
    )
    expect(forSnapshot(getAfterCreate.data)).toMatchSnapshot()

    // Update
    await db.transaction(async (tx) => {
      return await services.indexing(tx).indexRecord(...updateRecord)
    })

    const getAfterUpdate = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(sc.dids.alice, true) },
    )
    expect(forSnapshot(getAfterUpdate.data)).toMatchSnapshot()

    // Delete
    await db.transaction(async (tx) => {
      return await services.indexing(tx).deleteRecord(...deleteRecord)
    })

    const getAfterDelete = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(sc.dids.alice, true) },
    )
    expect(forSnapshot(getAfterDelete.data)).toMatchSnapshot()
  })

  describe('indexRepo', () => {
    beforeAll(async () => {
      testEnv.bsky.sub.resume()
      await basicSeed(sc, false)
      await processAll(testEnv)
      await testEnv.bsky.sub.destroy()
    })

    it('preserves indexes when no record changes.', async () => {
      const { db, services } = testEnv.bsky.ctx
      // Mark originals
      const { data: origProfile } = await agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        { headers: sc.getHeaders(sc.dids.alice, true) },
      )
      const { data: origFeed } = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: sc.dids.alice },
        { headers: sc.getHeaders(sc.dids.alice, true) },
      )
      const { data: origFollows } = await agent.api.app.bsky.graph.getFollows(
        { actor: sc.dids.alice },
        { headers: sc.getHeaders(sc.dids.alice, true) },
      )
      // Index
      const { data: head } = await pdsAgent.api.com.atproto.sync.getHead({
        did: sc.dids.alice,
      })
      await db.transaction((tx) =>
        services.indexing(tx).indexRepo(sc.dids.alice, head.root),
      )
      // Check
      const { data: profile } = await agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        { headers: sc.getHeaders(sc.dids.alice, true) },
      )
      const { data: feed } = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: sc.dids.alice },
        { headers: sc.getHeaders(sc.dids.alice, true) },
      )
      const { data: follows } = await agent.api.app.bsky.graph.getFollows(
        { actor: sc.dids.alice },
        { headers: sc.getHeaders(sc.dids.alice, true) },
      )
      expect(forSnapshot([origProfile, origFeed, origFollows])).toEqual(
        forSnapshot([profile, feed, follows]),
      )
    })

    it('updates indexes when records change.', async () => {
      const { db, services } = testEnv.bsky.ctx
      // Update profile
      await pdsAgent.api.com.atproto.repo.putRecord(
        {
          repo: sc.dids.alice,
          collection: ids.AppBskyActorProfile,
          rkey: 'self',
          record: { description: 'freshening things up' },
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )
      // Add post
      const newPost = await sc.post(sc.dids.alice, 'fresh post!')
      // Remove a follow
      const removedFollow = sc.follows[sc.dids.alice][sc.dids.carol]
      await pdsAgent.api.app.bsky.graph.follow.delete(
        { repo: sc.dids.alice, rkey: removedFollow.uri.rkey },
        sc.getHeaders(sc.dids.alice),
      )
      // Index
      const { data: head } = await pdsAgent.api.com.atproto.sync.getHead({
        did: sc.dids.alice,
      })
      await db.transaction((tx) =>
        services.indexing(tx).indexRepo(sc.dids.alice, head.root),
      )
      // Check
      const { data: profile } = await agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        { headers: sc.getHeaders(sc.dids.alice, true) },
      )
      const { data: feed } = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: sc.dids.alice },
        { headers: sc.getHeaders(sc.dids.alice, true) },
      )
      const { data: follows } = await agent.api.app.bsky.graph.getFollows(
        { actor: sc.dids.alice },
        { headers: sc.getHeaders(sc.dids.alice, true) },
      )
      expect(profile.description).toEqual('freshening things up')
      expect(feed.feed[0].post.uri).toEqual(newPost.ref.uriStr)
      expect(feed.feed[0].post.cid).toEqual(newPost.ref.cidStr)
      expect(follows.follows.map(({ did }) => did)).not.toContain(sc.dids.carol)
      expect(forSnapshot([profile, feed, follows])).toMatchSnapshot()
    })

    it('skips invalid records.', async () => {
      const { db, services } = testEnv.bsky.ctx
      const { db: pdsDb, services: pdsServices } = testEnv.pds.ctx
      // Create a good and a bad post record
      const writes = await Promise.all([
        pdsRepo.prepareCreate({
          did: sc.dids.alice,
          collection: ids.AppBskyFeedPost,
          record: { text: 'valid', createdAt: new Date().toISOString() },
        }),
        pdsRepo.prepareCreate({
          did: sc.dids.alice,
          collection: ids.AppBskyFeedPost,
          record: { text: 0 },
          validate: false,
        }),
      ])
      await pdsServices
        .repo(pdsDb)
        .processWrites({ did: sc.dids.alice, writes }, 1)
      // Index
      const { data: head } = await pdsAgent.api.com.atproto.sync.getHead({
        did: sc.dids.alice,
      })
      await db.transaction((tx) =>
        services.indexing(tx).indexRepo(sc.dids.alice, head.root),
      )
      // Check
      const getGoodPost = agent.api.app.bsky.feed.getPostThread(
        { uri: writes[0].uri.toString(), depth: 0 },
        { headers: sc.getHeaders(sc.dids.alice, true) },
      )
      await expect(getGoodPost).resolves.toBeDefined()
      const getBadPost = agent.api.app.bsky.feed.getPostThread(
        { uri: writes[1].uri.toString(), depth: 0 },
        { headers: sc.getHeaders(sc.dids.alice, true) },
      )
      await expect(getBadPost).rejects.toThrow('Post not found')
    })
  })

  describe('indexHandle', () => {
    const getIndexedHandle = async (did) => {
      const res = await agent.api.app.bsky.actor.getProfile(
        { actor: did },
        { headers: sc.getHeaders(sc.dids.alice, true) },
      )
      return res.data.handle
    }

    it('indexes handle for a fresh did', async () => {
      const { db, services } = testEnv.bsky.ctx
      const now = new Date().toISOString()
      const sessionAgent = new AtpAgent({ service: testEnv.pds.url })
      const {
        data: { did },
      } = await sessionAgent.createAccount({
        email: 'did1@test.com',
        handle: 'did1.test',
        password: 'password',
      })
      await expect(getIndexedHandle(did)).rejects.toThrow('Profile not found')
      await db.transaction((tx) => services.indexing(tx).indexHandle(did, now))
      await expect(getIndexedHandle(did)).resolves.toEqual('did1.test')
    })

    it('reindexes handle for existing did when forced', async () => {
      const { db, services } = testEnv.bsky.ctx
      const now = new Date().toISOString()
      const sessionAgent = new AtpAgent({ service: testEnv.pds.url })
      const {
        data: { did },
      } = await sessionAgent.createAccount({
        email: 'did2@test.com',
        handle: 'did2.test',
        password: 'password',
      })
      await db.transaction((tx) => services.indexing(tx).indexHandle(did, now))
      await expect(getIndexedHandle(did)).resolves.toEqual('did2.test')
      await sessionAgent.com.atproto.identity.updateHandle({
        handle: 'did2-updated.test',
      })
      await db.transaction((tx) => services.indexing(tx).indexHandle(did, now))
      await expect(getIndexedHandle(did)).resolves.toEqual('did2.test') // Didn't update, not forced
      await db.transaction((tx) =>
        services.indexing(tx).indexHandle(did, now, true),
      )
      await expect(getIndexedHandle(did)).resolves.toEqual('did2-updated.test')
    })
  })

  describe('tombstoneActor', () => {
    it('does not unindex actor when their did is not tombstoned', async () => {
      const { db, services } = testEnv.bsky.ctx
      const { data: profileBefore } = await agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        { headers: sc.getHeaders(sc.dids.bob, true) },
      )
      // Attempt indexing tombstone
      await db.transaction((tx) =>
        services.indexing(tx).tombstoneActor(sc.dids.alice),
      )
      const { data: profileAfter } = await agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        { headers: sc.getHeaders(sc.dids.bob, true) },
      )
      expect(profileAfter).toEqual(profileBefore)
    })

    it('unindexes actor when their did is tombstoned', async () => {
      const { db, services } = testEnv.bsky.ctx
      const getProfileBefore = agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        { headers: sc.getHeaders(sc.dids.bob, true) },
      )
      await expect(getProfileBefore).resolves.toBeDefined()
      // Tombstone alice's did
      const plcClient = new Client(testEnv.plc.url)
      await plcClient.tombstone(sc.dids.alice, testEnv.pds.ctx.plcRotationKey)
      // Index tombstone
      await db.transaction((tx) =>
        services.indexing(tx).tombstoneActor(sc.dids.alice),
      )
      const getProfileAfter = agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        { headers: sc.getHeaders(sc.dids.bob, true) },
      )
      await expect(getProfileAfter).rejects.toThrow('Profile not found')
    })
  })

  async function getNotifications(db: Database, uri: AtUri) {
    return await db.db
      .selectFrom('notification')
      .selectAll()
      .select(sql`0`.as('id')) // Ignore notification ids in comparisons
      .where('recordUri', '=', uri.toString())
      .orderBy('sortAt')
      .execute()
  }
})

async function prepareCreate(opts: {
  did: string
  collection: string
  rkey?: string
  record: unknown
  timestamp?: string
}): Promise<[AtUri, CID, unknown, WriteOpAction.Create, string]> {
  const rkey = opts.rkey ?? TID.nextStr()
  return [
    AtUri.make(opts.did, opts.collection, rkey),
    await cidForCbor(opts.record),
    opts.record,
    WriteOpAction.Create,
    opts.timestamp ?? new Date().toISOString(),
  ]
}

async function prepareUpdate(opts: {
  did: string
  collection: string
  rkey: string
  record: unknown
  timestamp?: string
}): Promise<[AtUri, CID, unknown, WriteOpAction.Update, string]> {
  return [
    AtUri.make(opts.did, opts.collection, opts.rkey),
    await cidForCbor(opts.record),
    opts.record,
    WriteOpAction.Update,
    opts.timestamp ?? new Date().toISOString(),
  ]
}

function prepareDelete(opts: {
  did: string
  collection: string
  rkey: string
}): [AtUri] {
  return [AtUri.make(opts.did, opts.collection, opts.rkey)]
}
