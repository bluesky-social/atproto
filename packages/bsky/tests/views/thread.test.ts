import AtpAgent, { AppBskyFeedGetPostThread } from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import { forSnapshot, stripViewerFromThread } from '../_util'
import assert from 'assert'
import { isThreadViewPost } from '@atproto/api/src/client/types/app/bsky/feed/defs'

describe('pds thread views', () => {
  let network: TestNetwork
  let agent: AtpAgent
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
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
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
      { headers: await network.serviceHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fetches shallow post thread', async () => {
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[alice][1].ref.uriStr },
      { headers: await network.serviceHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fetches ancestors', async () => {
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.replies[alice][0].ref.uriStr },
      { headers: await network.serviceHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fails for an unknown post', async () => {
    const promise = agent.api.app.bsky.feed.getPostThread(
      { uri: 'at://did:example:fake/does.not.exist/self' },
      { headers: await network.serviceHeaders(bob) },
    )

    await expect(promise).rejects.toThrow(
      AppBskyFeedGetPostThread.NotFoundError,
    )
  })

  it('fetches post thread unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: await network.serviceHeaders(bob) },
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
    await network.bsky.processAll()

    const thread1 = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][indexes.aliceRoot].ref.uriStr },
      { headers: await network.serviceHeaders(bob) },
    )
    expect(forSnapshot(thread1.data.thread)).toMatchSnapshot()

    await sc.deletePost(bob, sc.replies[bob][indexes.bobReply].ref.uri)
    await network.processAll()
    await network.bsky.processAll()

    const thread2 = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][indexes.aliceRoot].ref.uriStr },
      { headers: await network.serviceHeaders(bob) },
    )
    expect(forSnapshot(thread2.data.thread)).toMatchSnapshot()

    const thread3 = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.replies[alice][indexes.aliceReplyReply].ref.uriStr },
      { headers: await network.serviceHeaders(bob) },
    )
    expect(forSnapshot(thread3.data.thread)).toMatchSnapshot()
  })

  it('reflects self-labels', async () => {
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][0].ref.uriStr },
      { headers: await network.serviceHeaders(bob) },
    )

    assert(isThreadViewPost(thread.thread), 'post does not exist')
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
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: alice,
          },
          takedown: {
            applied: true,
            ref: 'test',
          },
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )

      // Same as shallow post thread test, minus alice
      const promise = agent.api.app.bsky.feed.getPostThread(
        { depth: 1, uri: sc.posts[alice][1].ref.uriStr },
        { headers: await network.serviceHeaders(bob) },
      )

      await expect(promise).rejects.toThrow(
        AppBskyFeedGetPostThread.NotFoundError,
      )

      // Cleanup
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: alice,
          },
          takedown: {
            applied: false,
          },
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )
    })

    it('blocks replies by actor', async () => {
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: carol,
          },
          takedown: {
            applied: true,
            ref: 'test',
          },
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )

      // Same as deep post thread test, minus carol
      const thread = await agent.api.app.bsky.feed.getPostThread(
        { uri: sc.posts[alice][1].ref.uriStr },
        { headers: await network.serviceHeaders(bob) },
      )

      expect(forSnapshot(thread.data.thread)).toMatchSnapshot()

      // Cleanup
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: carol,
          },
          takedown: {
            applied: false,
          },
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )
    })

    it('blocks ancestors by actor', async () => {
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: bob,
          },
          takedown: {
            applied: true,
            ref: 'test',
          },
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )

      // Same as ancestor post thread test, minus bob
      const thread = await agent.api.app.bsky.feed.getPostThread(
        { depth: 1, uri: sc.replies[alice][0].ref.uriStr },
        { headers: await network.serviceHeaders(bob) },
      )

      expect(forSnapshot(thread.data.thread)).toMatchSnapshot()

      // Cleanup
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: bob,
          },
          takedown: {
            applied: false,
          },
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )
    })

    it('blocks post by record', async () => {
      const postRef = sc.posts[alice][1].ref
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: postRef.uriStr,
            cid: postRef.cidStr,
          },
          takedown: {
            applied: true,
            ref: 'test',
          },
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )

      const promise = agent.api.app.bsky.feed.getPostThread(
        { depth: 1, uri: postRef.uriStr },
        { headers: await network.serviceHeaders(bob) },
      )

      await expect(promise).rejects.toThrow(
        AppBskyFeedGetPostThread.NotFoundError,
      )

      // Cleanup
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: postRef.uriStr,
            cid: postRef.cidStr,
          },
          takedown: {
            applied: false,
          },
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )
    })

    it('blocks ancestors by record', async () => {
      const threadPreTakedown = await agent.api.app.bsky.feed.getPostThread(
        { depth: 1, uri: sc.replies[alice][0].ref.uriStr },
        { headers: await network.serviceHeaders(bob) },
      )

      const parent = threadPreTakedown.data.thread.parent?.['post']

      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: parent.uri,
            cid: parent.cid,
          },
          takedown: {
            applied: true,
            ref: 'test',
          },
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )

      // Same as ancestor post thread test, minus parent post
      const thread = await agent.api.app.bsky.feed.getPostThread(
        { depth: 1, uri: sc.replies[alice][0].ref.uriStr },
        { headers: await network.serviceHeaders(bob) },
      )

      expect(forSnapshot(thread.data.thread)).toMatchSnapshot()

      // Cleanup
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: parent.uri,
            cid: parent.cid,
          },
          takedown: {
            applied: false,
          },
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )
    })

    it('blocks replies by record', async () => {
      const threadPreTakedown = await agent.api.app.bsky.feed.getPostThread(
        { uri: sc.posts[alice][1].ref.uriStr },
        { headers: await network.serviceHeaders(bob) },
      )
      const post1 = threadPreTakedown.data.thread.replies?.[0].post
      const post2 = threadPreTakedown.data.thread.replies?.[1].replies[0].post

      await Promise.all(
        [post1, post2].map((post) =>
          agent.api.com.atproto.admin.updateSubjectStatus(
            {
              subject: {
                $type: 'com.atproto.repo.strongRef',
                uri: post.uri,
                cid: post.cid,
              },
              takedown: {
                applied: true,
                ref: 'test',
              },
            },
            {
              encoding: 'application/json',
              headers: network.bsky.adminAuthHeaders(),
            },
          ),
        ),
      )

      // Same as deep post thread test, minus some replies
      const thread = await agent.api.app.bsky.feed.getPostThread(
        { uri: sc.posts[alice][1].ref.uriStr },
        { headers: await network.serviceHeaders(bob) },
      )

      expect(forSnapshot(thread.data.thread)).toMatchSnapshot()

      // Cleanup
      await Promise.all(
        [post1, post2].map((post) =>
          agent.api.com.atproto.admin.updateSubjectStatus(
            {
              event: {
                $type: 'com.atproto.admin.defs#modEventReverseTakedown',
              },
              subject: {
                $type: 'com.atproto.repo.strongRef',
                uri: post.uri,
                cid: post.cid,
              },
              takedown: {
                applied: false,
              },
            },
            {
              encoding: 'application/json',
              headers: network.bsky.adminAuthHeaders(),
            },
          ),
        ),
      )
    })
  })
})
