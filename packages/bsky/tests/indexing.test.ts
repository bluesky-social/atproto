import { sql } from 'kysely'
import { CID } from 'multiformats/cid'
import { cidForCbor, TID } from '@atproto/common'
import * as pdsRepo from '@atproto/pds/src/repo/prepare'
import { WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import AtpAgent, {
  AppBskyActorProfile,
  AppBskyFeedPost,
  AppBskyFeedLike,
  AppBskyFeedRepost,
  AppBskyGraphFollow,
} from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { forSnapshot } from './_util'
import { SeedClient } from './seeds/client'
import usersSeed from './seeds/users'
import basicSeed from './seeds/basic'
import { ids } from '../src/lexicon/lexicons'
import { Database } from '../src/db'

describe('indexing', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_indexing',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await usersSeed(sc)
    // Data in tests is not processed from subscription
    await network.processAll()
    await network.bsky.ingester.sub.destroy()
    await network.bsky.indexer.sub.destroy()
    await network.bsky.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('indexes posts.', async () => {
    const { db, services } = network.bsky.indexer.ctx
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
    await services.indexing(db).indexRecord(...createRecord)

    const getAfterCreate = await agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )
    expect(forSnapshot(getAfterCreate.data)).toMatchSnapshot()
    const createNotifications = await getNotifications(db, uri)

    // Update
    await services.indexing(db).indexRecord(...updateRecord)

    const getAfterUpdate = await agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )
    expect(forSnapshot(getAfterUpdate.data)).toMatchSnapshot()
    const updateNotifications = await getNotifications(db, uri)

    // Delete
    await services.indexing(db).deleteRecord(...deleteRecord)

    const getAfterDelete = agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      { headers: await network.serviceHeaders(sc.dids.alice) },
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
    const { db, services } = network.bsky.indexer.ctx
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
    await services.indexing(db).indexRecord(...createRecord)

    const getAfterCreate = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )
    expect(forSnapshot(getAfterCreate.data)).toMatchSnapshot()

    // Update
    await services.indexing(db).indexRecord(...updateRecord)

    const getAfterUpdate = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )
    expect(forSnapshot(getAfterUpdate.data)).toMatchSnapshot()

    // Delete
    await services.indexing(db).deleteRecord(...deleteRecord)

    const getAfterDelete = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )
    expect(forSnapshot(getAfterDelete.data)).toMatchSnapshot()
  })

  it('handles post aggregations out of order.', async () => {
    const { db, services } = network.bsky.indexer.ctx
    const createdAt = new Date().toISOString()
    const originalPost = await prepareCreate({
      did: sc.dids.alice,
      collection: ids.AppBskyFeedPost,
      record: {
        $type: ids.AppBskyFeedPost,
        text: 'original post',
        createdAt,
      } as AppBskyFeedPost.Record,
    })
    const originalPostRef = {
      uri: originalPost[0].toString(),
      cid: originalPost[1].toString(),
    }
    const reply = await prepareCreate({
      did: sc.dids.bob,
      collection: ids.AppBskyFeedPost,
      record: {
        $type: ids.AppBskyFeedPost,
        text: 'reply post',
        reply: {
          root: originalPostRef,
          parent: originalPostRef,
        },
        createdAt,
      } as AppBskyFeedPost.Record,
    })
    const like = await prepareCreate({
      did: sc.dids.bob,
      collection: ids.AppBskyFeedLike,
      record: {
        $type: ids.AppBskyFeedLike,
        subject: originalPostRef,
        createdAt,
      } as AppBskyFeedLike.Record,
    })
    const repost = await prepareCreate({
      did: sc.dids.bob,
      collection: ids.AppBskyFeedRepost,
      record: {
        $type: ids.AppBskyFeedRepost,
        subject: originalPostRef,
        createdAt,
      } as AppBskyFeedRepost.Record,
    })
    // reply, like, and repost indexed orior to the original post
    await services.indexing(db).indexRecord(...reply)
    await services.indexing(db).indexRecord(...like)
    await services.indexing(db).indexRecord(...repost)
    await services.indexing(db).indexRecord(...originalPost)
    await network.bsky.processAll()
    const agg = await db.db
      .selectFrom('post_agg')
      .selectAll()
      .where('uri', '=', originalPostRef.uri)
      .executeTakeFirst()
    expect(agg).toEqual({
      uri: originalPostRef.uri,
      replyCount: 1,
      repostCount: 1,
      likeCount: 1,
    })
    // Cleanup
    const del = (uri: AtUri) => {
      return prepareDelete({
        did: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
      })
    }
    await services.indexing(db).deleteRecord(...del(reply[0]))
    await services.indexing(db).deleteRecord(...del(like[0]))
    await services.indexing(db).deleteRecord(...del(repost[0]))
    await services.indexing(db).deleteRecord(...del(originalPost[0]))
  })

  it('does not notify user of own like or repost', async () => {
    const { db, services } = network.bsky.indexer.ctx
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
      uri: originalPost[0].toString(),
      cid: originalPost[1].toString(),
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

    await services.indexing(db).indexRecord(...originalPost)
    await services.indexing(db).indexRecord(...ownLike)
    await services.indexing(db).indexRecord(...ownRepost)
    await services.indexing(db).indexRecord(...aliceLike)
    await services.indexing(db).indexRecord(...aliceRepost)

    await network.bsky.processAll()

    const {
      data: { notifications },
    } = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: await network.serviceHeaders(sc.dids.bob) },
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

    await services.indexing(db).deleteRecord(...del(ownLike[0]))
    await services.indexing(db).deleteRecord(...del(ownRepost[0]))
    await services.indexing(db).deleteRecord(...del(aliceLike[0]))
    await services.indexing(db).deleteRecord(...del(aliceRepost[0]))
    await services.indexing(db).deleteRecord(...del(originalPost[0]))
  })

  it('handles profile aggregations out of order.', async () => {
    const { db, services } = network.bsky.indexer.ctx
    const createdAt = new Date().toISOString()
    const unknownDid = 'did:example:unknown'
    const follow = await prepareCreate({
      did: sc.dids.bob,
      collection: ids.AppBskyGraphFollow,
      record: {
        $type: ids.AppBskyGraphFollow,
        subject: unknownDid,
        createdAt,
      } as AppBskyGraphFollow.Record,
    })
    await services.indexing(db).indexRecord(...follow)
    await network.bsky.processAll()
    const agg = await db.db
      .selectFrom('profile_agg')
      .select(['did', 'followersCount'])
      .where('did', '=', unknownDid)
      .executeTakeFirst()
    expect(agg).toEqual({
      did: unknownDid,
      followersCount: 1,
    })
    // Cleanup
    const del = (uri: AtUri) => {
      return prepareDelete({
        did: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
      })
    }
    await services.indexing(db).deleteRecord(...del(follow[0]))
  })

  describe('indexRepo', () => {
    beforeAll(async () => {
      network.bsky.indexer.sub.resume()
      network.bsky.ingester.sub.resume()
      await basicSeed(sc, false)
      await network.processAll()
      await network.bsky.ingester.sub.destroy()
      await network.bsky.indexer.sub.destroy()
      await network.bsky.processAll()
    })

    it('preserves indexes when no record changes.', async () => {
      const { db, services } = network.bsky.indexer.ctx
      // Mark originals
      const { data: origProfile } = await agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        { headers: await network.serviceHeaders(sc.dids.alice) },
      )
      const { data: origFeed } = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: sc.dids.alice },
        { headers: await network.serviceHeaders(sc.dids.alice) },
      )
      const { data: origFollows } = await agent.api.app.bsky.graph.getFollows(
        { actor: sc.dids.alice },
        { headers: await network.serviceHeaders(sc.dids.alice) },
      )
      // Index
      const { data: head } = await pdsAgent.api.com.atproto.sync.getHead({
        did: sc.dids.alice,
      })
      await services.indexing(db).indexRepo(sc.dids.alice, head.root)
      await network.bsky.processAll()
      // Check
      const { data: profile } = await agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        { headers: await network.serviceHeaders(sc.dids.alice) },
      )
      const { data: feed } = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: sc.dids.alice },
        { headers: await network.serviceHeaders(sc.dids.alice) },
      )
      const { data: follows } = await agent.api.app.bsky.graph.getFollows(
        { actor: sc.dids.alice },
        { headers: await network.serviceHeaders(sc.dids.alice) },
      )
      expect(forSnapshot([origProfile, origFeed, origFollows])).toEqual(
        forSnapshot([profile, feed, follows]),
      )
    })

    it('updates indexes when records change.', async () => {
      const { db, services } = network.bsky.indexer.ctx
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
      await services.indexing(db).indexRepo(sc.dids.alice, head.root)
      await network.bsky.processAll()
      // Check
      const { data: profile } = await agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        { headers: await network.serviceHeaders(sc.dids.alice) },
      )
      const { data: feed } = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: sc.dids.alice },
        { headers: await network.serviceHeaders(sc.dids.alice) },
      )
      const { data: follows } = await agent.api.app.bsky.graph.getFollows(
        { actor: sc.dids.alice },
        { headers: await network.serviceHeaders(sc.dids.alice) },
      )
      expect(profile.description).toEqual('freshening things up')
      expect(feed.feed[0].post.uri).toEqual(newPost.ref.uriStr)
      expect(feed.feed[0].post.cid).toEqual(newPost.ref.cidStr)
      expect(follows.follows.map(({ did }) => did)).not.toContain(sc.dids.carol)
      expect(forSnapshot([profile, feed, follows])).toMatchSnapshot()
    })

    it('skips invalid records.', async () => {
      const { db, services } = network.bsky.indexer.ctx
      const { db: pdsDb, services: pdsServices } = network.pds.ctx
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
      await services.indexing(db).indexRepo(sc.dids.alice, head.root)
      // Check
      const getGoodPost = agent.api.app.bsky.feed.getPostThread(
        { uri: writes[0].uri.toString(), depth: 0 },
        { headers: await network.serviceHeaders(sc.dids.alice) },
      )
      await expect(getGoodPost).resolves.toBeDefined()
      const getBadPost = agent.api.app.bsky.feed.getPostThread(
        { uri: writes[1].uri.toString(), depth: 0 },
        { headers: await network.serviceHeaders(sc.dids.alice) },
      )
      await expect(getBadPost).rejects.toThrow('Post not found')
    })
  })

  describe('indexHandle', () => {
    const getIndexedHandle = async (did) => {
      const res = await agent.api.app.bsky.actor.getProfile(
        { actor: did },
        { headers: await network.serviceHeaders(sc.dids.alice) },
      )
      return res.data.handle
    }

    it('indexes handle for a fresh did', async () => {
      const { db, services } = network.bsky.indexer.ctx
      const now = new Date().toISOString()
      const sessionAgent = new AtpAgent({ service: network.pds.url })
      const {
        data: { did },
      } = await sessionAgent.createAccount({
        email: 'did1@test.com',
        handle: 'did1.test',
        password: 'password',
      })
      await expect(getIndexedHandle(did)).rejects.toThrow('Profile not found')
      await services.indexing(db).indexHandle(did, now)
      await expect(getIndexedHandle(did)).resolves.toEqual('did1.test')
    })

    it('reindexes handle for existing did when forced', async () => {
      const { db, services } = network.bsky.indexer.ctx
      const now = new Date().toISOString()
      const sessionAgent = new AtpAgent({ service: network.pds.url })
      const {
        data: { did },
      } = await sessionAgent.createAccount({
        email: 'did2@test.com',
        handle: 'did2.test',
        password: 'password',
      })
      await services.indexing(db).indexHandle(did, now)
      await expect(getIndexedHandle(did)).resolves.toEqual('did2.test')
      await sessionAgent.com.atproto.identity.updateHandle({
        handle: 'did2-updated.test',
      })
      await services.indexing(db).indexHandle(did, now)
      await expect(getIndexedHandle(did)).resolves.toEqual('did2.test') // Didn't update, not forced
      await services.indexing(db).indexHandle(did, now, true)
      await expect(getIndexedHandle(did)).resolves.toEqual('did2-updated.test')
    })

    it('handles profile aggregations out of order', async () => {
      const { db, services } = network.bsky.indexer.ctx
      const now = new Date().toISOString()
      const sessionAgent = new AtpAgent({ service: network.pds.url })
      const {
        data: { did },
      } = await sessionAgent.createAccount({
        email: 'did3@test.com',
        handle: 'did3.test',
        password: 'password',
      })
      const follow = await prepareCreate({
        did: sc.dids.bob,
        collection: ids.AppBskyGraphFollow,
        record: {
          $type: ids.AppBskyGraphFollow,
          subject: did,
          createdAt: now,
        } as AppBskyGraphFollow.Record,
      })
      await services.indexing(db).indexRecord(...follow)
      await services.indexing(db).indexHandle(did, now)
      await network.bsky.processAll()
      const agg = await db.db
        .selectFrom('profile_agg')
        .select(['did', 'followersCount'])
        .where('did', '=', did)
        .executeTakeFirst()
      expect(agg).toEqual({
        did,
        followersCount: 1,
      })
    })
  })

  describe('tombstoneActor', () => {
    it('does not unindex actor when they are still being hosted by their pds', async () => {
      const { db, services } = network.bsky.indexer.ctx
      const { data: profileBefore } = await agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        { headers: await network.serviceHeaders(sc.dids.bob) },
      )
      // Attempt indexing tombstone
      await services.indexing(db).tombstoneActor(sc.dids.alice)
      const { data: profileAfter } = await agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        { headers: await network.serviceHeaders(sc.dids.bob) },
      )
      expect(profileAfter).toEqual(profileBefore)
    })

    it('unindexes actor when they are no longer hosted by their pds', async () => {
      const { db, services } = network.bsky.indexer.ctx
      const { alice } = sc.dids
      const getProfileBefore = agent.api.app.bsky.actor.getProfile(
        { actor: alice },
        { headers: await network.serviceHeaders(sc.dids.bob) },
      )
      await expect(getProfileBefore).resolves.toBeDefined()
      // Delete account on pds
      await pdsAgent.api.com.atproto.server.requestAccountDelete(undefined, {
        headers: sc.getHeaders(alice),
      })
      const { token } = await network.pds.ctx.db.db
        .selectFrom('delete_account_token')
        .selectAll()
        .where('did', '=', alice)
        .executeTakeFirstOrThrow()
      await pdsAgent.api.com.atproto.server.deleteAccount({
        token,
        did: alice,
        password: sc.accounts[alice].password,
      })
      await network.pds.ctx.backgroundQueue.processAll()
      // Index tombstone
      await services.indexing(db).tombstoneActor(alice)
      const getProfileAfter = agent.api.app.bsky.actor.getProfile(
        { actor: alice },
        { headers: await network.serviceHeaders(sc.dids.bob) },
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
