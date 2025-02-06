import assert from 'node:assert'
import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import {
  isNotFoundPost,
  isThreadViewPost,
} from '../../src/lexicon/types/app/bsky/feed/defs'
import { forSnapshot } from '../_util'

describe('views with thread gating', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_thread_gating',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await sc.createAccount('eve', {
      handle: 'eve.test',
      email: 'eve@eve.com',
      password: 'hunter2',
    })
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  // check that replyDisabled state is applied correctly in a simple method like getPosts
  const checkReplyDisabled = async (
    uri: string,
    user: string,
    blocked: boolean | undefined,
  ) => {
    const res = await agent.api.app.bsky.feed.getPosts(
      { uris: [uri] },
      { headers: await network.serviceHeaders(user, ids.AppBskyFeedGetPosts) },
    )
    expect(res.data.posts[0].viewer?.replyDisabled).toBe(blocked)
  }

  it('applies gate for empty rules.', async () => {
    const post = await sc.post(sc.dids.carol, 'empty rules')
    const { uri: threadgateUri } =
      await pdsAgent.api.app.bsky.feed.threadgate.create(
        { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
        { post: post.ref.uriStr, createdAt: iso(), allow: [] },
        sc.getHeaders(sc.dids.carol),
      )
    await network.processAll()
    await sc.reply(sc.dids.alice, post.ref, post.ref, 'empty rules reply')
    await network.processAll()
    const {
      data: { thread, threadgate },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(thread))
    expect(forSnapshot(thread.post.threadgate)).toMatchSnapshot()
    expect(thread.post.viewer?.replyDisabled).toBe(true)
    expect(thread.replies?.length).toEqual(0)
    expect(threadgate?.uri).toEqual(threadgateUri)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.alice, true)
  })

  it('does not generate notifications when post violates threadgate.', async () => {
    const post = await sc.post(sc.dids.carol, 'notifications')
    await pdsAgent.api.app.bsky.feed.threadgate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      { post: post.ref.uriStr, createdAt: iso(), allow: [] },
      sc.getHeaders(sc.dids.carol),
    )
    await network.processAll()
    const reply = await sc.reply(
      sc.dids.alice,
      post.ref,
      post.ref,
      'notifications reply',
    )
    await network.processAll()
    const {
      data: { notifications },
    } = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          sc.dids.carol,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    const notificationFromReply = notifications.find(
      (notif) => notif.uri === reply.ref.uriStr,
    )
    expect(notificationFromReply).toBeUndefined()
  })

  it('applies gate for mention rule.', async () => {
    const post = await sc.post(
      sc.dids.carol,
      'mention rules @carol.test @dan.test',
      [
        {
          index: { byteStart: 14, byteEnd: 25 },
          features: [
            { $type: 'app.bsky.richtext.facet#mention', did: sc.dids.carol },
          ],
        },
        {
          index: { byteStart: 26, byteEnd: 35 },
          features: [
            { $type: 'app.bsky.richtext.facet#mention', did: sc.dids.dan },
          ],
        },
      ],
    )
    await pdsAgent.api.app.bsky.feed.threadgate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      {
        post: post.ref.uriStr,
        createdAt: iso(),
        allow: [{ $type: 'app.bsky.feed.threadgate#mentionRule' }],
      },
      sc.getHeaders(sc.dids.carol),
    )
    await network.processAll()
    await sc.reply(
      sc.dids.alice,
      post.ref,
      post.ref,
      'mention rule reply disallow',
    )
    const danReply = await sc.reply(
      sc.dids.dan,
      post.ref,
      post.ref,
      'mention rule reply allow',
    )
    await network.processAll()
    const {
      data: { thread: aliceThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(aliceThread))
    expect(aliceThread.post.viewer?.replyDisabled).toBe(true)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.alice, true)
    const {
      data: { thread: danThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.dan,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(danThread))
    expect(forSnapshot(danThread.post.threadgate)).toMatchSnapshot()
    expect(danThread.post.viewer?.replyDisabled).toBe(false)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.dan, false)
    const [reply, ...otherReplies] = danThread.replies ?? []
    assert(isThreadViewPost(reply))
    expect(otherReplies.length).toEqual(0)
    expect(reply.post.uri).toEqual(danReply.ref.uriStr)
  })

  it('applies gate for following rule.', async () => {
    const post = await sc.post(sc.dids.carol, 'following rule')
    await pdsAgent.api.app.bsky.feed.threadgate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      {
        post: post.ref.uriStr,
        createdAt: iso(),
        allow: [{ $type: 'app.bsky.feed.threadgate#followingRule' }],
      },
      sc.getHeaders(sc.dids.carol),
    )
    await network.processAll()
    // carol only follows alice
    await sc.reply(
      sc.dids.dan,
      post.ref,
      post.ref,
      'following rule reply disallow',
    )
    const aliceReply = await sc.reply(
      sc.dids.alice,
      post.ref,
      post.ref,
      'following rule reply allow',
    )
    await network.processAll()
    const {
      data: { thread: danThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.dan,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(danThread))
    expect(danThread.post.viewer?.replyDisabled).toBe(true)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.dan, true)
    const {
      data: { thread: aliceThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(aliceThread))
    expect(forSnapshot(aliceThread.post.threadgate)).toMatchSnapshot()
    expect(aliceThread.post.viewer?.replyDisabled).toBe(false)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.alice, false)
    const [reply, ...otherReplies] = aliceThread.replies ?? []
    assert(isThreadViewPost(reply))
    expect(otherReplies.length).toEqual(0)
    expect(reply.post.uri).toEqual(aliceReply.ref.uriStr)
  })

  it('applies gate for follower rule.', async () => {
    const post = await sc.post(sc.dids.carol, 'follower rule')
    await pdsAgent.api.app.bsky.feed.threadgate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      {
        post: post.ref.uriStr,
        createdAt: iso(),
        allow: [{ $type: 'app.bsky.feed.threadgate#followerRule' }],
      },
      sc.getHeaders(sc.dids.carol),
    )
    await network.processAll()

    // dan does not follow carol, can't reply
    await sc.reply(
      sc.dids.dan,
      post.ref,
      post.ref,
      'follower rule reply disallow',
    )

    // alice follows carol, can reply
    const aliceReply = await sc.reply(
      sc.dids.alice,
      post.ref,
      post.ref,
      'follower rule reply allow',
    )
    await network.processAll()
    const {
      data: { thread: danThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.dan,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(danThread))
    expect(danThread.post.viewer?.replyDisabled).toBe(true)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.dan, true)
    const {
      data: { thread: aliceThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(aliceThread))
    expect(forSnapshot(aliceThread.post.threadgate)).toMatchSnapshot()
    expect(aliceThread.post.viewer?.replyDisabled).toBe(false)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.alice, false)
    const [reply, ...otherReplies] = aliceThread.replies ?? []
    assert(isThreadViewPost(reply))
    expect(otherReplies.length).toEqual(0)
    expect(reply.post.uri).toEqual(aliceReply.ref.uriStr)
  })

  it('applies gate for list rule.', async () => {
    const post = await sc.post(sc.dids.carol, 'list rule')
    // setup lists to allow alice and dan
    const listA = await pdsAgent.api.app.bsky.graph.list.create(
      { repo: sc.dids.carol },
      {
        name: 'list a',
        purpose: 'app.bsky.graph.defs#modlist',
        createdAt: iso(),
      },
      sc.getHeaders(sc.dids.carol),
    )
    await pdsAgent.api.app.bsky.graph.listitem.create(
      { repo: sc.dids.carol },
      {
        list: listA.uri,
        subject: sc.dids.alice,
        createdAt: iso(),
      },
      sc.getHeaders(sc.dids.carol),
    )
    const listB = await pdsAgent.api.app.bsky.graph.list.create(
      { repo: sc.dids.carol },
      {
        name: 'list b',
        purpose: 'app.bsky.graph.defs#modlist',
        createdAt: iso(),
      },
      sc.getHeaders(sc.dids.carol),
    )
    await pdsAgent.api.app.bsky.graph.listitem.create(
      { repo: sc.dids.carol },
      {
        list: listB.uri,
        subject: sc.dids.dan,
        createdAt: iso(),
      },
      sc.getHeaders(sc.dids.carol),
    )
    await pdsAgent.api.app.bsky.feed.threadgate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      {
        post: post.ref.uriStr,
        createdAt: iso(),
        allow: [
          { $type: 'app.bsky.feed.threadgate#listRule', list: listA.uri },
          { $type: 'app.bsky.feed.threadgate#listRule', list: listB.uri },
        ],
      },
      sc.getHeaders(sc.dids.carol),
    )
    await network.processAll()
    //
    await sc.reply(sc.dids.bob, post.ref, post.ref, 'list rule reply disallow')
    const aliceReply = await sc.reply(
      sc.dids.alice,
      post.ref,
      post.ref,
      'list rule reply allow (list a)',
    )
    const danReply = await sc.reply(
      sc.dids.dan,
      post.ref,
      post.ref,
      'list rule reply allow (list b)',
    )
    await network.processAll()
    const {
      data: { thread: bobThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(bobThread))
    expect(bobThread.post.viewer?.replyDisabled).toBe(true)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.bob, true)
    const {
      data: { thread: aliceThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(aliceThread))
    expect(aliceThread.post.viewer?.replyDisabled).toBe(false)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.alice, false)
    const {
      data: { thread: danThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.dan,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(danThread))
    expect(forSnapshot(danThread.post.threadgate)).toMatchSnapshot()
    expect(danThread.post.viewer?.replyDisabled).toBe(false)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.dan, false)
    const [reply1, reply2, ...otherReplies] = aliceThread.replies ?? []
    assert(isThreadViewPost(reply1))
    assert(isThreadViewPost(reply2))
    expect(otherReplies.length).toEqual(0)
    expect([reply1.post.uri, reply2.post.uri].sort()).toEqual(
      [danReply.ref.uriStr, aliceReply.ref.uriStr].sort(),
    )
  })

  it('applies gate for unknown list rule.', async () => {
    const post = await sc.post(sc.dids.carol, 'unknown list rules')
    await pdsAgent.api.app.bsky.feed.threadgate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      {
        post: post.ref.uriStr,
        createdAt: iso(),
        allow: [
          {
            $type: 'app.bsky.feed.threadgate#listRule',
            list: post.ref.uriStr, // bad list link, references a post
          },
        ],
      },
      sc.getHeaders(sc.dids.carol),
    )
    await network.processAll()
    await sc.reply(
      sc.dids.alice,
      post.ref,
      post.ref,
      'unknown list rules reply',
    )
    await network.processAll()
    const {
      data: { thread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(thread))
    expect(forSnapshot(thread.post.threadgate)).toMatchSnapshot()
    expect(thread.post.viewer?.replyDisabled).toBe(true)
    expect(thread.replies?.length).toEqual(0)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.alice, true)
  })

  it('applies gate for multiple rules.', async () => {
    const post = await sc.post(sc.dids.carol, 'multi rules @dan.test', [
      {
        index: { byteStart: 12, byteEnd: 21 },
        features: [
          { $type: 'app.bsky.richtext.facet#mention', did: sc.dids.dan },
        ],
      },
    ])
    await pdsAgent.api.app.bsky.feed.threadgate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      {
        post: post.ref.uriStr,
        createdAt: iso(),
        allow: [
          { $type: 'app.bsky.feed.threadgate#mentionRule' },
          { $type: 'app.bsky.feed.threadgate#followerRule' },
          { $type: 'app.bsky.feed.threadgate#followingRule' },
        ],
      },
      sc.getHeaders(sc.dids.carol),
    )
    await network.processAll()

    await sc.reply(sc.dids.eve, post.ref, post.ref, 'multi rule reply disallow')
    const bobReply = await sc.reply(
      sc.dids.bob,
      post.ref,
      post.ref,
      'multi rule reply allow (follower)',
    )
    const aliceReply = await sc.reply(
      sc.dids.alice,
      post.ref,
      post.ref,
      'multi rule reply allow (following)',
    )
    const danReply = await sc.reply(
      sc.dids.dan,
      post.ref,
      post.ref,
      'multi rule reply allow (mention)',
    )
    await network.processAll()

    const {
      data: { thread: eveThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.eve,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(eveThread))
    // eve cannot interact
    expect(eveThread.post.viewer?.replyDisabled).toBe(true)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.eve, true)

    const {
      data: { thread: bobThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(bobThread))
    // bob follows carol, followers can reply
    expect(bobThread.post.viewer?.replyDisabled).toBe(false)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.bob, false)

    const {
      data: { thread: aliceThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(aliceThread))
    // carol follows alice, followed users can reply
    expect(aliceThread.post.viewer?.replyDisabled).toBe(false)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.alice, false)

    const {
      data: { thread: danThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.dan,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(danThread))
    expect(forSnapshot(danThread.post.threadgate)).toMatchSnapshot()
    // dan was mentioned, mentioned users can reply
    expect(danThread.post.viewer?.replyDisabled).toBe(false)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.dan, false)

    const [reply1, reply2, reply3, ...otherReplies] = aliceThread.replies ?? []
    assert(isThreadViewPost(reply1))
    assert(isThreadViewPost(reply2))
    assert(isThreadViewPost(reply3))
    expect(otherReplies.length).toEqual(0)
    expect([reply1.post.uri, reply2.post.uri, reply3.post.uri].sort()).toEqual(
      [aliceReply.ref.uriStr, danReply.ref.uriStr, bobReply.ref.uriStr].sort(),
    )
  })

  it('applies gate for missing rules, takes no action.', async () => {
    const post = await sc.post(sc.dids.carol, 'missing rules')
    await pdsAgent.api.app.bsky.feed.threadgate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      { post: post.ref.uriStr, createdAt: iso() },
      sc.getHeaders(sc.dids.carol),
    )
    await network.processAll()
    const aliceReply = await sc.reply(
      sc.dids.alice,
      post.ref,
      post.ref,
      'missing rules reply',
    )
    await network.processAll()
    const {
      data: { thread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(thread))
    expect(forSnapshot(thread.post.threadgate)).toMatchSnapshot()
    expect(thread.post.viewer?.replyDisabled).toBe(false)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.alice, false)
    const [reply, ...otherReplies] = thread.replies ?? []
    assert(isThreadViewPost(reply))
    expect(otherReplies.length).toEqual(0)
    expect(reply.post.uri).toEqual(aliceReply.ref.uriStr)
  })

  it('applies gate after root post is deleted.', async () => {
    // @NOTE also covers rule application more than one level deep
    const post = await sc.post(sc.dids.carol, 'following rule w/ post deletion')
    await pdsAgent.api.app.bsky.feed.threadgate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      {
        post: post.ref.uriStr,
        createdAt: iso(),
        allow: [{ $type: 'app.bsky.feed.threadgate#followingRule' }],
      },
      sc.getHeaders(sc.dids.carol),
    )
    await network.processAll()
    // carol only follows alice
    const orphanedReply = await sc.reply(
      sc.dids.alice,
      post.ref,
      post.ref,
      'following rule reply allow',
    )
    await pdsAgent.api.app.bsky.feed.post.delete(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      sc.getHeaders(sc.dids.carol),
    )
    await network.processAll()
    await sc.reply(
      sc.dids.dan,
      post.ref,
      orphanedReply.ref,
      'following rule reply disallow',
    )
    const aliceReply = await sc.reply(
      sc.dids.alice,
      post.ref,
      orphanedReply.ref,
      'following rule reply allow',
    )
    await network.processAll()
    const {
      data: { thread: danThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: orphanedReply.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.dan,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(danThread))
    expect(danThread.post.viewer?.replyDisabled).toBe(true)
    await checkReplyDisabled(orphanedReply.ref.uriStr, sc.dids.dan, true)
    const {
      data: { thread: aliceThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: orphanedReply.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(aliceThread))
    assert(
      isNotFoundPost(aliceThread.parent) &&
        aliceThread.parent.uri === post.ref.uriStr,
    )
    expect(aliceThread.post.threadgate).toMatchSnapshot()
    expect(aliceThread.post.viewer?.replyDisabled).toBe(false)
    await checkReplyDisabled(orphanedReply.ref.uriStr, sc.dids.alice, false)
    const [reply, ...otherReplies] = aliceThread.replies ?? []
    assert(isThreadViewPost(reply))
    expect(otherReplies.length).toEqual(0)
    expect(reply.post.uri).toEqual(aliceReply.ref.uriStr)
  })

  it('does not apply gate to original poster.', async () => {
    const post = await sc.post(sc.dids.carol, 'empty rules')
    await pdsAgent.api.app.bsky.feed.threadgate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      { post: post.ref.uriStr, createdAt: iso(), allow: [] },
      sc.getHeaders(sc.dids.carol),
    )
    await network.processAll()
    const selfReply = await sc.reply(
      sc.dids.carol,
      post.ref,
      post.ref,
      'empty rules reply allow',
    )
    await network.processAll()
    const {
      data: { thread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.carol,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(thread))
    expect(forSnapshot(thread.post.threadgate)).toMatchSnapshot()
    expect(thread.post.viewer?.replyDisabled).toBe(false)
    await checkReplyDisabled(post.ref.uriStr, sc.dids.carol, false)
    const [reply, ...otherReplies] = thread.replies ?? []
    assert(isThreadViewPost(reply))
    expect(otherReplies.length).toEqual(0)
    expect(reply.post.uri).toEqual(selfReply.ref.uriStr)
  })

  it('displays gated posts in feed and thread anchor without reply context.', async () => {
    const post = await sc.post(sc.dids.carol, 'following rule')
    await pdsAgent.api.app.bsky.feed.threadgate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      {
        post: post.ref.uriStr,
        createdAt: iso(),
        allow: [{ $type: 'app.bsky.feed.threadgate#followingRule' }],
      },
      sc.getHeaders(sc.dids.carol),
    )
    await network.processAll()
    // carol only follows alice
    const badReply = await sc.reply(
      sc.dids.dan,
      post.ref,
      post.ref,
      'following rule reply disallow',
    )
    // going to ensure this one doesn't appear in badReply's thread
    await sc.reply(sc.dids.alice, post.ref, badReply.ref, 'reply to disallowed')
    await network.processAll()
    // check thread view
    const {
      data: { thread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: badReply.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(thread))
    expect(thread.post.viewer?.replyDisabled).toBe(true) // nobody can reply to this, not even alice.
    expect(thread.replies).toBeUndefined()
    expect(thread.parent).toBeUndefined()
    expect(thread.post.threadgate).toBeUndefined()
    await checkReplyDisabled(badReply.ref.uriStr, sc.dids.alice, true)
    // check feed view
    const {
      data: { feed },
    } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.dids.dan },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetAuthorFeed,
        ),
      },
    )
    const [feedItem] = feed
    expect(feedItem.post.uri).toEqual(badReply.ref.uriStr)
    expect(feedItem.post.threadgate).toBeUndefined()
    expect(feedItem.reply).toBeUndefined()
  })

  it('does not apply gate unless it matches post rkey.', async () => {
    const postA = await sc.post(sc.dids.carol, 'ungated a')
    const postB = await sc.post(sc.dids.carol, 'ungated b')
    await pdsAgent.api.app.bsky.feed.threadgate.create(
      { repo: sc.dids.carol, rkey: postA.ref.uri.rkey },
      { post: postB.ref.uriStr, createdAt: iso(), allow: [] },
      sc.getHeaders(sc.dids.carol),
    )
    await network.processAll()
    await sc.reply(sc.dids.alice, postA.ref, postA.ref, 'ungated reply')
    await sc.reply(sc.dids.alice, postB.ref, postB.ref, 'ungated reply')
    await network.processAll()
    const {
      data: { thread: threadA },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: postA.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(threadA))
    expect(threadA.post.threadgate).toBeUndefined()
    expect(threadA.post.viewer?.replyDisabled).toBeUndefined()
    expect(threadA.replies?.length).toEqual(1)
    await checkReplyDisabled(postA.ref.uriStr, sc.dids.alice, undefined)
    const {
      data: { thread: threadB },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: postB.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )
    assert(isThreadViewPost(threadB))
    expect(threadB.post.threadgate).toBeUndefined()
    expect(threadB.post.viewer?.replyDisabled).toBe(undefined)
    await checkReplyDisabled(postB.ref.uriStr, sc.dids.alice, undefined)
    expect(threadB.replies?.length).toEqual(1)
  })
})

const iso = (date = new Date()) => date.toISOString()
