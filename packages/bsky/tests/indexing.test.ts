import { CID } from 'multiformats/cid'
import { cidForCbor, TID } from '@atproto/common'
import { WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import AtpAgent, { AppBskyActorProfile, AppBskyFeedPost } from '@atproto/api'
import {
  CloseFn,
  forSnapshot,
  processAll,
  runTestServer,
  TestServerInfo,
} from './_util'
import { SeedClient } from './seeds/client'
import usersSeed from './seeds/users'
import basicSeed from './seeds/basic'
import { ids } from '../src/lexicon/lexicons'

describe('indexing', () => {
  let server: TestServerInfo
  let close: CloseFn
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'indexing',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    pdsAgent = new AtpAgent({ service: server.pdsUrl })
    sc = new SeedClient(pdsAgent)
    await usersSeed(sc)
    // Data in tests is not processed from subscription
    await processAll(server)
    await server.bsky.sub.destroy()
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
    const createMessages = await db.transaction(async (tx) => {
      return await services.indexing(tx).indexRecord(...createRecord)
    })

    const getAfterCreate = await agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      { headers: sc.getHeaders(sc.dids.alice, true) },
    )
    expect(forSnapshot(getAfterCreate.data)).toMatchSnapshot()

    // Update
    const updateMessages = await db.transaction(async (tx) => {
      return await services.indexing(tx).indexRecord(...updateRecord)
    })

    const getAfterUpdate = await agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      { headers: sc.getHeaders(sc.dids.alice, true) },
    )
    expect(forSnapshot(getAfterUpdate.data)).toMatchSnapshot()

    // Delete
    const deletedMessages = await db.transaction(async (tx) => {
      return await services.indexing(tx).deleteRecord(...deleteRecord)
    })

    const getAfterDelete = agent.api.app.bsky.feed.getPostThread(
      { uri: uri.toString() },
      { headers: sc.getHeaders(sc.dids.alice, true) },
    )
    await expect(getAfterDelete).rejects.toThrow(/Post not found:/)

    expect(
      forSnapshot({
        createMessages,
        updateMessages,
        deletedMessages,
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
    const createMessages = await db.transaction(async (tx) => {
      return await services.indexing(tx).indexRecord(...createRecord)
    })

    const getAfterCreate = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(sc.dids.alice, true) },
    )
    expect(forSnapshot(getAfterCreate.data)).toMatchSnapshot()

    // Update
    const updateMessages = await db.transaction(async (tx) => {
      return await services.indexing(tx).indexRecord(...updateRecord)
    })

    const getAfterUpdate = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(sc.dids.alice, true) },
    )
    expect(forSnapshot(getAfterUpdate.data)).toMatchSnapshot()

    // Delete
    const deletedMessages = await db.transaction(async (tx) => {
      return await services.indexing(tx).deleteRecord(...deleteRecord)
    })

    const getAfterDelete = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(sc.dids.alice, true) },
    )
    expect(forSnapshot(getAfterDelete.data)).toMatchSnapshot()

    expect(
      forSnapshot({
        createMessages,
        updateMessages,
        deletedMessages,
      }),
    ).toMatchSnapshot()
  })

  describe('indexRepo', () => {
    beforeAll(async () => {
      server.bsky.sub.resume()
      await basicSeed(sc, false)
      await processAll(server)
      await server.bsky.sub.destroy()
    })

    it('preserves indexes when no record changes.', async () => {
      const { db, services } = server.ctx
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
      await services.indexing(db).indexRepo(sc.dids.alice, head.root)
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
      const { db, services } = server.ctx
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
  })
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
