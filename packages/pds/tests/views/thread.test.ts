import AtpAgent, { AppBskyFeedGetPostThread } from '@atproto/api'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'
import { Database } from '../../src'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
  adminAuth,
  TestServerInfo,
} from '../_util'
import { RecordRef, SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import threadSeed, { walk, item, Item } from '../seeds/thread'

describe('pds thread views', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let db: Database
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'views_thread',
    })
    db = server.ctx.db
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
  })

  beforeAll(async () => {
    // Add a repost of a reply so that we can confirm viewer state in the thread
    await sc.repost(bob, sc.replies[alice][0].ref)
    await server.ctx.backgroundQueue.processAll()
  })

  afterAll(async () => {
    await close()
  })

  it('fetches deep post thread', async () => {
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fetches shallow post thread', async () => {
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fetches ancestors', async () => {
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.replies[alice][0].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fails for an unknown post', async () => {
    const promise = agent.api.app.bsky.feed.getPostThread(
      { uri: 'at://did:example:fake/does.not.exist/self' },
      { headers: sc.getHeaders(bob) },
    )

    await expect(promise).rejects.toThrow(
      AppBskyFeedGetPostThread.NotFoundError,
    )
  })

  it('includes the muted status of post authors.', async () => {
    await agent.api.app.bsky.graph.muteActor(
      { actor: alice },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()

    await agent.api.app.bsky.graph.unmuteActor(
      { actor: alice },
      { encoding: 'application/json', headers: sc.getHeaders(bob) },
    )
  })

  it('handles deleted posts correctly', async () => {
    const alice = sc.dids.alice
    const bob = sc.dids.bob

    const indexes = {
      aliceRoot: -1,
      bobReply: -1,
      aliceReplyReply: -1,
    }

    await sc.post(alice, 'Deletion thread')
    indexes.aliceRoot = sc.posts[alice].length - 1

    await sc.reply(
      bob,
      sc.posts[alice][indexes.aliceRoot].ref,
      sc.posts[alice][indexes.aliceRoot].ref,
      'Reply',
    )
    indexes.bobReply = sc.replies[bob].length - 1
    await sc.reply(
      alice,
      sc.posts[alice][indexes.aliceRoot].ref,
      sc.replies[bob][indexes.bobReply].ref,
      'Reply reply',
    )
    indexes.aliceReplyReply = sc.replies[alice].length - 1
    await server.ctx.backgroundQueue.processAll()

    const thread1 = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][indexes.aliceRoot].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )
    expect(forSnapshot(thread1.data.thread)).toMatchSnapshot()

    await sc.deletePost(bob, sc.replies[bob][indexes.bobReply].ref.uri)
    await server.ctx.backgroundQueue.processAll()

    const thread2 = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][indexes.aliceRoot].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )
    expect(forSnapshot(thread2.data.thread)).toMatchSnapshot()

    const thread3 = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.replies[alice][indexes.aliceReplyReply].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )
    expect(forSnapshot(thread3.data.thread)).toMatchSnapshot()
  })

  it('blocks post by actor takedown', async () => {
    const { data: modAction } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: alice,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    // Same as shallow post thread test, minus alice
    const promise = agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    await expect(promise).rejects.toThrow(
      AppBskyFeedGetPostThread.NotFoundError,
    )

    // Cleanup
    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: modAction.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })

  it('blocks replies by actor takedown', async () => {
    const { data: modAction } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: carol,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    // Same as deep post thread test, minus carol
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()

    // Cleanup
    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: modAction.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })

  it('blocks ancestors by actor takedown', async () => {
    const { data: modAction } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: bob,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    // Same as ancestor post thread test, minus bob
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.replies[alice][0].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()

    // Cleanup
    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: modAction.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })

  it('blocks post by record takedown', async () => {
    const postRef = sc.posts[alice][1].ref
    const { data: modAction } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: postRef.uriStr,
            cid: postRef.cidStr,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    const promise = agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: postRef.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    await expect(promise).rejects.toThrow(
      AppBskyFeedGetPostThread.NotFoundError,
    )

    // Cleanup
    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: modAction.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })

  it('blocks ancestors by record takedown', async () => {
    const threadPreTakedown = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.replies[alice][0].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    const parent = threadPreTakedown.data.thread.parent?.['post']

    const { data: modAction } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: parent.uri,
            cid: parent.cid,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    // Same as ancestor post thread test, minus parent post
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.replies[alice][0].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()

    // Cleanup
    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: modAction.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })

  it('blocks replies by record takedown', async () => {
    const threadPreTakedown = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )
    const post1 = threadPreTakedown.data.thread.replies?.[0].post
    const post2 = threadPreTakedown.data.thread.replies?.[1].replies[0].post

    const actionResults = await Promise.all(
      [post1, post2].map((post) =>
        agent.api.com.atproto.admin.takeModerationAction(
          {
            action: TAKEDOWN,
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: post.uri,
              cid: post.cid,
            },
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        ),
      ),
    )

    // Same as deep post thread test, minus some replies
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()

    // Cleanup
    await Promise.all(
      actionResults.map((result) =>
        agent.api.com.atproto.admin.reverseModerationAction(
          {
            id: result.data.id,
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        ),
      ),
    )
  })

  it('builds post hierarchy index.', async () => {
    const threads: Item[] = [
      item(1, [item(2, [item(3), item(4)])]),
      item(5, [item(6), item(7, [item(9, [item(11)]), item(10)]), item(8)]),
      item(12),
    ]
    await threadSeed(sc, sc.dids.alice, threads)
    let closureSize = 0
    const itemByUri: Record<string, Item> = {}

    const postsAndReplies = ([] as { text: string; ref: RecordRef }[])
      .concat(Object.values(sc.posts[sc.dids.alice]))
      .concat(Object.values(sc.replies[sc.dids.alice]))
      .filter((p) => {
        const id = parseInt(p.text, 10)
        return 0 < id && id <= 12
      })

    await walk(threads, async (item, depth) => {
      const post = postsAndReplies.find((p) => p.text === String(item.id))
      if (!post) throw new Error('Post not found')
      itemByUri[post.ref.uriStr] = item
      closureSize += depth + 1
    })

    const hierarchy = await db.db
      .selectFrom('post_hierarchy')
      .where(
        'uri',
        'in',
        postsAndReplies.map((p) => p.ref.uriStr),
      )
      .orWhere(
        'ancestorUri',
        'in',
        postsAndReplies.map((p) => p.ref.uriStr),
      )
      .selectAll()
      .execute()

    expect(hierarchy.length).toEqual(closureSize)

    for (const relation of hierarchy) {
      const item = itemByUri[relation.uri]
      const ancestor = itemByUri[relation.ancestorUri]
      let depth = -1
      await walk([ancestor], async (candidate, candidateDepth) => {
        if (candidate === item) {
          depth = candidateDepth
        }
      })
      expect(depth).toEqual(relation.depth)
    }
  })
})
