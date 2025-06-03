import assert from 'node:assert'
import { AppBskyFeedGetPostThread, AtUri, AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { isThreadViewPost } from '../../src/lexicon/types/app/bsky/feed/defs'
import {
  assertIsThreadViewPost,
  forSnapshot,
  stripViewerFromThread,
} from '../_util'

describe('appview thread views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_thread',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol

    await sc.like(alice, sc.replies[alice][0].ref)
    await sc.like(alice, sc.replies[bob][0].ref)
    await sc.like(alice, sc.replies[carol][0].ref)
  })

  beforeAll(async () => {
    // Add a repost of a reply so that we can confirm myState in the thread
    await sc.repost(bob, sc.replies[alice][0].ref)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('fetches deep post thread', async () => {
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][1].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fetches shallow post thread', async () => {
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[alice][1].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fetches thread with handle in uri', async () => {
    const thread = await agent.api.app.bsky.feed.getPostThread(
      {
        depth: 1,
        uri: sc.posts[alice][1].ref.uriStr.replace(
          `at://${alice}`,
          `at://${sc.accounts[alice].handle}`,
        ),
      },
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fetches ancestors', async () => {
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.replies[alice][0].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fails for an unknown post', async () => {
    const promise = agent.api.app.bsky.feed.getPostThread(
      { uri: 'at://did:example:fake/does.not.exist/self' },
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )

    await expect(promise).rejects.toThrow(
      AppBskyFeedGetPostThread.NotFoundError,
    )
  })

  it('fetches post thread unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][1].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    const { data: unauthed } = await agent.api.app.bsky.feed.getPostThread({
      uri: sc.posts[alice][1].ref.uriStr,
    })
    expect(unauthed.thread).toEqual(stripViewerFromThread(authed.thread))
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
    await network.processAll()

    const thread1 = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][indexes.aliceRoot].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    expect(forSnapshot(thread1.data.thread)).toMatchSnapshot()

    await sc.deletePost(bob, sc.replies[bob][indexes.bobReply].ref.uri)
    await network.processAll()

    const thread2 = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][indexes.aliceRoot].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    expect(forSnapshot(thread2.data.thread)).toMatchSnapshot()

    const thread3 = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.replies[alice][indexes.aliceReplyReply].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    expect(forSnapshot(thread3.data.thread)).toMatchSnapshot()
  })

  it('omits parents and replies w/ different root than anchor post.', async () => {
    const badRoot = sc.posts[alice][0]
    const goodRoot = await sc.post(alice, 'good root')
    const goodReply1 = await sc.reply(
      alice,
      goodRoot.ref,
      goodRoot.ref,
      'good reply 1',
    )
    const goodReply2 = await sc.reply(
      alice,
      goodRoot.ref,
      goodReply1.ref,
      'good reply 2',
    )
    const badReply = await sc.reply(
      alice,
      badRoot.ref,
      goodReply1.ref,
      'bad reply',
    )
    await network.processAll()
    // good reply doesn't have replies w/ different root
    const { data: goodReply1Thread } =
      await agent.api.app.bsky.feed.getPostThread(
        { uri: goodReply1.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )
    assertIsThreadViewPost(goodReply1Thread.thread)
    assertIsThreadViewPost(goodReply1Thread.thread.parent)
    expect(goodReply1Thread.thread.parent.post.uri).toEqual(goodRoot.ref.uriStr)
    expect(
      goodReply1Thread.thread.replies?.map((r) => {
        assertIsThreadViewPost(r)
        return r.post.uri
      }),
    ).toEqual([
      goodReply2.ref.uriStr, // does not contain badReply
    ])
    expect(goodReply1Thread.thread.parent.replies).toBeUndefined()
    // bad reply doesn't have a parent, which would have a different root
    const { data: badReplyThread } =
      await agent.api.app.bsky.feed.getPostThread(
        { uri: badReply.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )
    assertIsThreadViewPost(badReplyThread.thread)
    expect(badReplyThread.thread.parent).toBeUndefined() // is not goodReply1
  })

  it('reflects self-labels', async () => {
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][0].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )

    assertIsThreadViewPost(thread.thread)

    const post = thread.thread.post

    const postSelfLabels = post.labels
      ?.filter((label) => label.src === alice)
      .map((label) => label.val)

    expect(postSelfLabels).toEqual(['self-label'])

    const authorSelfLabels = post.author.labels
      ?.filter((label) => label.src === alice)
      .map((label) => label.val)
      .sort()

    expect(authorSelfLabels).toEqual(['self-label-a', 'self-label-b'])
  })

  describe('takedown', () => {
    it('blocks post by actor', async () => {
      await network.bsky.ctx.dataplane.takedownActor({
        did: alice,
      })

      // Same as shallow post thread test, minus alice
      const promise = agent.api.app.bsky.feed.getPostThread(
        { depth: 1, uri: sc.posts[alice][1].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            bob,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      await expect(promise).rejects.toThrow(
        AppBskyFeedGetPostThread.NotFoundError,
      )

      // Cleanup
      await network.bsky.ctx.dataplane.untakedownActor({
        did: alice,
      })
    })

    it('blocks replies by actor', async () => {
      await network.bsky.ctx.dataplane.takedownActor({
        did: carol,
      })

      // Same as deep post thread test, minus carol
      const thread = await agent.api.app.bsky.feed.getPostThread(
        { uri: sc.posts[alice][1].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            bob,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      expect(forSnapshot(thread.data.thread)).toMatchSnapshot()

      // Cleanup
      await network.bsky.ctx.dataplane.untakedownActor({
        did: carol,
      })
    })

    it('blocks ancestors by actor', async () => {
      await network.bsky.ctx.dataplane.takedownActor({
        did: bob,
      })

      // Same as ancestor post thread test, minus bob
      const thread = await agent.api.app.bsky.feed.getPostThread(
        { depth: 1, uri: sc.replies[alice][0].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            bob,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      expect(forSnapshot(thread.data.thread)).toMatchSnapshot()

      // Cleanup
      await network.bsky.ctx.dataplane.untakedownActor({
        did: bob,
      })
    })

    it('blocks post by record', async () => {
      const postRef = sc.posts[alice][1].ref
      await network.bsky.ctx.dataplane.takedownRecord({
        recordUri: postRef.uriStr,
      })

      const promise = agent.api.app.bsky.feed.getPostThread(
        { depth: 1, uri: postRef.uriStr },
        {
          headers: await network.serviceHeaders(
            bob,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      await expect(promise).rejects.toThrow(
        AppBskyFeedGetPostThread.NotFoundError,
      )

      // Cleanup
      await network.bsky.ctx.dataplane.untakedownRecord({
        recordUri: postRef.uriStr,
      })
    })

    it('blocks ancestors by record', async () => {
      const threadPreTakedown = await agent.api.app.bsky.feed.getPostThread(
        { depth: 1, uri: sc.replies[alice][0].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            bob,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      assert(isThreadViewPost(threadPreTakedown.data.thread))
      assert(isThreadViewPost(threadPreTakedown.data.thread.parent))

      const parent = threadPreTakedown.data.thread.parent.post

      await network.bsky.ctx.dataplane.takedownRecord({
        recordUri: parent.uri,
      })

      // Same as ancestor post thread test, minus parent post
      const thread = await agent.api.app.bsky.feed.getPostThread(
        { depth: 1, uri: sc.replies[alice][0].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            bob,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      expect(forSnapshot(thread.data.thread)).toMatchSnapshot()

      // Cleanup
      await network.bsky.ctx.dataplane.untakedownRecord({
        recordUri: parent.uri,
      })
    })

    it('blocks replies by record', async () => {
      const threadPreTakedown = await agent.api.app.bsky.feed.getPostThread(
        { uri: sc.posts[alice][1].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            bob,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      assert(isThreadViewPost(threadPreTakedown.data.thread))
      assert(isThreadViewPost(threadPreTakedown.data.thread.replies?.[0]))
      assert(isThreadViewPost(threadPreTakedown.data.thread.replies?.[1]))
      assert(
        isThreadViewPost(
          threadPreTakedown.data.thread.replies?.[1].replies?.[0],
        ),
      )

      const post1 = threadPreTakedown.data.thread.replies?.[0].post
      const post2 = threadPreTakedown.data.thread.replies?.[1].replies?.[0].post

      await Promise.all(
        [post1, post2].map((post) =>
          network.bsky.ctx.dataplane.takedownRecord({
            recordUri: post.uri,
          }),
        ),
      )

      // Same as deep post thread test, minus some replies
      const thread = await agent.api.app.bsky.feed.getPostThread(
        { uri: sc.posts[alice][1].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            bob,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      expect(forSnapshot(thread.data.thread)).toMatchSnapshot()

      // Cleanup
      await Promise.all(
        [post1, post2].map((post) =>
          network.bsky.ctx.dataplane.untakedownRecord({
            recordUri: post.uri,
          }),
        ),
      )
    })
  })

  describe('listblock', () => {
    it(`doesn't apply listblock if list was taken down by private takedown`, async () => {
      const post = await sc.post(carol, `I'm carol`)
      const reply = await sc.reply(bob, post.ref, post.ref, `hi carol`)

      // alice creates a block list that includes carol
      const listRef = await sc.createList(alice, 'alice blocks', 'mod')
      await sc.addToList(alice, carol, listRef)
      // bob subscribes to that list
      const listblockRef = await pdsAgent.app.bsky.graph.listblock.create(
        { repo: bob },
        {
          subject: listRef.uriStr,
          createdAt: new Date().toISOString(),
        },
        sc.getHeaders(bob),
      )
      await network.processAll()

      const threadBeforeListTakedown = await agent.app.bsky.feed.getPostThread(
        { depth: 1, uri: reply.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            carol,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )
      expect(
        forSnapshot(threadBeforeListTakedown.data.thread),
      ).toMatchSnapshot()

      // Takedown the list
      await network.bsky.ctx.dataplane.takedownRecord({
        recordUri: listRef.uriStr,
      })
      await network.processAll()

      const threadAfterListTakedown = await agent.app.bsky.feed.getPostThread(
        { depth: 1, uri: reply.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            carol,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )
      expect(forSnapshot(threadAfterListTakedown.data.thread)).toMatchSnapshot()

      // Cleanup
      await pdsAgent.app.bsky.graph.listblock.delete(
        { repo: bob, rkey: new AtUri(listblockRef.uri).rkey },
        sc.getHeaders(bob),
      )
      await network.bsky.ctx.dataplane.untakedownRecord({
        recordUri: listRef.uriStr,
      })
      await network.processAll()
    })

    it(`doesn't apply listblock if list was taken down by takedown label`, async () => {
      const post = await sc.post(carol, `I'm carol`)
      const reply = await sc.reply(bob, post.ref, post.ref, `hi carol`)

      // alice creates a block list that includes carol
      const listRef = await sc.createList(alice, 'alice blocks', 'mod')
      await sc.addToList(alice, carol, listRef)
      // bob subscribes to that list
      const listblockRef = await pdsAgent.app.bsky.graph.listblock.create(
        { repo: bob },
        {
          subject: listRef.uriStr,
          createdAt: new Date().toISOString(),
        },
        sc.getHeaders(bob),
      )

      const threadBeforeListTakedown = await agent.app.bsky.feed.getPostThread(
        { depth: 1, uri: reply.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            carol,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )
      expect(
        forSnapshot(threadBeforeListTakedown.data.thread),
      ).toMatchSnapshot()

      // Takedown the list
      const src = network.ozone.ctx.cfg.service.did
      const label = {
        src,
        uri: listRef.uriStr,
        cid: '',
        val: '!takedown',
        exp: null,
        neg: false,
        cts: new Date().toISOString(),
      }
      AtpAgent.configure({ appLabelers: [src] })
      await network.bsky.db.db.insertInto('label').values(label).execute()

      const threadAfterListTakedown = await agent.app.bsky.feed.getPostThread(
        { depth: 1, uri: reply.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            carol,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      expect(forSnapshot(threadAfterListTakedown.data.thread)).toMatchSnapshot()

      // Cleanup
      await pdsAgent.app.bsky.graph.listblock.delete(
        { repo: bob, rkey: new AtUri(listblockRef.uri).rkey },
        sc.getHeaders(bob),
      )
      await network.bsky.db.db
        .deleteFrom('label')
        .where('src', '=', src)
        .where('uri', '=', listRef.uriStr)
        .execute()
      await network.processAll()
    })
  })
})
