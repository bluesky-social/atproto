import { sql } from 'kysely'
import { CID } from 'multiformats/cid'
import {
  AppBskyActorProfile,
  AppBskyFeedLike,
  AppBskyFeedPost,
  AppBskyFeedRepost,
  AppBskyGraphFollow,
  AtpAgent,
} from '@atproto/api'
import { TID, cidForCbor } from '@atproto/common'
import { SeedClient, TestNetwork, basicSeed, usersSeed } from '@atproto/dev-env'
import { repoPrepare } from '@atproto/pds'
import { WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { Database } from '../../src/data-plane/server/db'
import { ids } from '../../src/lexicon/lexicons'
import { forSnapshot } from '../_util'

describe('indexing', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let db: Database

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_indexing',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    db = network.bsky.db
    await usersSeed(sc)
    // Data in tests is not processed from subscription
    await network.processAll()
    await network.bsky.sub.destroy()
  })

  afterAll(async () => {
    await network.close()
  })

  it('indexes posts.', async () => {
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
    await network.bsky.sub.indexingSvc.indexRecord(...createRecord)

    const getAfterCreate = await agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    expect(forSnapshot(getAfterCreate.data)).toMatchSnapshot()
    const createNotifications = await getNotifications(db, uri)

    // Update
    await network.bsky.sub.indexingSvc.indexRecord(...updateRecord)

    const getAfterUpdate = await agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    expect(forSnapshot(getAfterUpdate.data)).toMatchSnapshot()
    const updateNotifications = await getNotifications(db, uri)

    // Delete
    await network.bsky.sub.indexingSvc.deleteRecord(...deleteRecord)

    const getAfterDelete = agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
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
    await network.bsky.sub.indexingSvc.indexRecord(...createRecord)

    const getAfterCreate = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyActorGetProfile,
        ),
      },
    )
    expect(forSnapshot(getAfterCreate.data)).toMatchSnapshot()

    // Update
    await network.bsky.sub.indexingSvc.indexRecord(...updateRecord)

    const getAfterUpdate = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyActorGetProfile,
        ),
      },
    )
    expect(forSnapshot(getAfterUpdate.data)).toMatchSnapshot()

    // Delete
    await network.bsky.sub.indexingSvc.deleteRecord(...deleteRecord)

    const getAfterDelete = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyActorGetProfile,
        ),
      },
    )
    expect(forSnapshot(getAfterDelete.data)).toMatchSnapshot()
  })

  it('handles post aggregations out of order.', async () => {
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
    await network.bsky.sub.indexingSvc.indexRecord(...reply)
    await network.bsky.sub.indexingSvc.indexRecord(...like)
    await network.bsky.sub.indexingSvc.indexRecord(...repost)
    await network.bsky.sub.indexingSvc.indexRecord(...originalPost)
    await network.bsky.sub.background.processAll()
    const agg = await db.db
      .selectFrom('post_agg')
      .selectAll()
      .where('uri', '=', originalPostRef.uri)
      .executeTakeFirst()
    expect(agg).toEqual({
      uri: originalPostRef.uri,
      bookmarkCount: 0,
      replyCount: 1,
      repostCount: 1,
      likeCount: 1,
      quoteCount: 0,
    })
    // Cleanup
    const del = (uri: AtUri) => {
      return prepareDelete({
        did: uri.host,
        collection: uri.collection,
        rkey: uri.rkey,
      })
    }
    await network.bsky.sub.indexingSvc.deleteRecord(...del(reply[0]))
    await network.bsky.sub.indexingSvc.deleteRecord(...del(like[0]))
    await network.bsky.sub.indexingSvc.deleteRecord(...del(repost[0]))
    await network.bsky.sub.indexingSvc.deleteRecord(...del(originalPost[0]))
  })

  it('does not notify user of own like or repost', async () => {
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

    await network.bsky.sub.indexingSvc.indexRecord(...originalPost)
    await network.bsky.sub.indexingSvc.indexRecord(...ownLike)
    await network.bsky.sub.indexingSvc.indexRecord(...ownRepost)
    await network.bsky.sub.indexingSvc.indexRecord(...aliceLike)
    await network.bsky.sub.indexingSvc.indexRecord(...aliceRepost)
    await network.bsky.sub.background.processAll()

    const {
      data: { notifications },
    } = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyNotificationListNotifications,
        ),
      },
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

    await network.bsky.sub.indexingSvc.deleteRecord(...del(ownLike[0]))
    await network.bsky.sub.indexingSvc.deleteRecord(...del(ownRepost[0]))
    await network.bsky.sub.indexingSvc.deleteRecord(...del(aliceLike[0]))
    await network.bsky.sub.indexingSvc.deleteRecord(...del(aliceRepost[0]))
    await network.bsky.sub.indexingSvc.deleteRecord(...del(originalPost[0]))
  })

  it('handles profile aggregations out of order.', async () => {
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
    await network.bsky.sub.indexingSvc.indexRecord(...follow)
    await network.bsky.sub.background.processAll()
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
    await network.bsky.sub.indexingSvc.deleteRecord(...del(follow[0]))
  })

  describe('indexRepo', () => {
    beforeAll(async () => {
      await network.bsky.sub.restart()
      await basicSeed(sc, false)
      await network.processAll()
      await network.bsky.sub.destroy()
      await network.bsky.sub.background.processAll()
    })

    it('preserves indexes when no record changes.', async () => {
      // Mark originals
      const { data: origProfile } = await agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      const { data: origFeed } = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: sc.dids.alice },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyFeedGetAuthorFeed,
          ),
        },
      )
      const { data: origFollows } = await agent.api.app.bsky.graph.getFollows(
        { actor: sc.dids.alice },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyGraphGetFollows,
          ),
        },
      )
      // Index
      const { data: commit } =
        await pdsAgent.api.com.atproto.sync.getLatestCommit({
          did: sc.dids.alice,
        })
      await network.bsky.sub.indexingSvc.indexRepo(sc.dids.alice, commit.cid)
      await network.bsky.sub.background.processAll()
      // Check
      const { data: profile } = await agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      const { data: feed } = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: sc.dids.alice },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyFeedGetAuthorFeed,
          ),
        },
      )
      const { data: follows } = await agent.api.app.bsky.graph.getFollows(
        { actor: sc.dids.alice },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyGraphGetFollows,
          ),
        },
      )
      expect(forSnapshot([origProfile, origFeed, origFollows])).toEqual(
        forSnapshot([profile, feed, follows]),
      )
    })

    it('updates indexes when records change.', async () => {
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
      const { data: commit } =
        await pdsAgent.api.com.atproto.sync.getLatestCommit({
          did: sc.dids.alice,
        })
      await network.bsky.sub.indexingSvc.indexRepo(sc.dids.alice, commit.cid)
      await network.bsky.sub.background.processAll()
      // Check
      const { data: profile } = await agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      const { data: feed } = await agent.api.app.bsky.feed.getAuthorFeed(
        { actor: sc.dids.alice },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyFeedGetAuthorFeed,
          ),
        },
      )
      const { data: follows } = await agent.api.app.bsky.graph.getFollows(
        { actor: sc.dids.alice },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyGraphGetFollows,
          ),
        },
      )
      expect(profile.description).toEqual('freshening things up')
      expect(feed.feed[0].post.uri).toEqual(newPost.ref.uriStr)
      expect(feed.feed[0].post.cid).toEqual(newPost.ref.cidStr)
      expect(follows.follows.map(({ did }) => did)).not.toContain(sc.dids.carol)
      expect(forSnapshot([profile, feed, follows])).toMatchSnapshot()
    })

    it('skips invalid records.', async () => {
      const { accountManager } = network.pds.ctx
      // const { db: pdsDb, services: pdsServices } = network.pds.ctx
      // Create a good and a bad post record
      const writes = await Promise.all([
        repoPrepare.prepareCreate({
          did: sc.dids.alice,
          collection: ids.AppBskyFeedPost,
          record: { text: 'valid', createdAt: new Date().toISOString() },
        }),
        repoPrepare.prepareCreate({
          did: sc.dids.alice,
          collection: ids.AppBskyFeedPost,
          record: { text: 0 },
          validate: false,
        }),
      ])
      const writeCommit = await network.pds.ctx.actorStore.transact(
        sc.dids.alice,
        (store) => store.repo.processWrites(writes),
      )
      await accountManager.updateRepoRoot(
        sc.dids.alice,
        writeCommit.cid,
        writeCommit.rev,
      )
      await network.pds.ctx.sequencer.sequenceCommit(sc.dids.alice, writeCommit)
      // Index
      const { data: commit } =
        await pdsAgent.api.com.atproto.sync.getLatestCommit({
          did: sc.dids.alice,
        })
      await network.bsky.sub.indexingSvc.indexRepo(sc.dids.alice, commit.cid)
      // Check
      const getGoodPost = agent.api.app.bsky.feed.getPostThread(
        { uri: writes[0].uri.toString(), depth: 0 },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )
      await expect(getGoodPost).resolves.toBeDefined()
      const getBadPost = agent.api.app.bsky.feed.getPostThread(
        { uri: writes[1].uri.toString(), depth: 0 },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )
      await expect(getBadPost).rejects.toThrow('Post not found')
    })
  })

  describe('indexHandle', () => {
    const getIndexedHandle = async (did) => {
      const res = await agent.api.app.bsky.actor.getProfile(
        { actor: did },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      return res.data.handle
    }

    it('indexes handle for a fresh did', async () => {
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
      await network.bsky.sub.indexingSvc.indexHandle(did, now)
      await expect(getIndexedHandle(did)).resolves.toEqual('did1.test')
    })

    it('reindexes handle for existing did when forced', async () => {
      const now = new Date().toISOString()
      const sessionAgent = network.pds.getClient()
      const {
        data: { did },
      } = await sessionAgent.createAccount({
        email: 'did2@test.com',
        handle: 'did2.test',
        password: 'password',
      })
      await network.bsky.sub.indexingSvc.indexHandle(did, now)
      await expect(getIndexedHandle(did)).resolves.toEqual('did2.test')
      await sessionAgent.com.atproto.identity.updateHandle({
        handle: 'did2-updated.test',
      })
      await network.bsky.sub.indexingSvc.indexHandle(did, now)
      await expect(getIndexedHandle(did)).resolves.toEqual('did2.test') // Didn't update, not forced
      await network.bsky.sub.indexingSvc.indexHandle(did, now, true)
      await expect(getIndexedHandle(did)).resolves.toEqual('did2-updated.test')
    })

    it('handles profile aggregations out of order', async () => {
      const now = new Date().toISOString()
      const agent = network.pds.getClient()
      await agent.createAccount({
        email: 'did3@test.com',
        handle: 'did3.test',
        password: 'password',
      })
      const did = agent.accountDid
      const follow = await prepareCreate({
        did: sc.dids.bob,
        collection: ids.AppBskyGraphFollow,
        record: {
          $type: ids.AppBskyGraphFollow,
          subject: did,
          createdAt: now,
        } as AppBskyGraphFollow.Record,
      })
      await network.bsky.sub.indexingSvc.indexRecord(...follow)
      await network.bsky.sub.indexingSvc.indexHandle(did, now)
      await network.bsky.sub.background.processAll()
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

  describe('deleteActor', () => {
    it('does not unindex actor when they are still being hosted by their pds', async () => {
      const { data: profileBefore } = await agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        {
          headers: await network.serviceHeaders(
            sc.dids.bob,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      // Attempt indexing tombstone
      await network.bsky.sub.indexingSvc.deleteActor(sc.dids.alice)
      const { data: profileAfter } = await agent.api.app.bsky.actor.getProfile(
        { actor: sc.dids.alice },
        {
          headers: await network.serviceHeaders(
            sc.dids.bob,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      expect(profileAfter).toEqual(profileBefore)
    })

    it('unindexes actor when they are no longer hosted by their pds', async () => {
      const { alice } = sc.dids
      const getProfileBefore = agent.api.app.bsky.actor.getProfile(
        { actor: alice },
        {
          headers: await network.serviceHeaders(
            sc.dids.bob,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      await expect(getProfileBefore).resolves.toBeDefined()
      // Delete account on pds
      const token = await network.pds.ctx.accountManager.createEmailToken(
        alice,
        'delete_account',
      )
      await pdsAgent.api.com.atproto.server.deleteAccount({
        token,
        did: alice,
        password: sc.accounts[alice].password,
      })
      await network.pds.ctx.backgroundQueue.processAll()
      // Index tombstone
      await network.bsky.sub.indexingSvc.deleteActor(alice)
      const getProfileAfter = agent.api.app.bsky.actor.getProfile(
        { actor: alice },
        {
          headers: await network.serviceHeaders(
            sc.dids.bob,
            ids.AppBskyActorGetProfile,
          ),
        },
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
