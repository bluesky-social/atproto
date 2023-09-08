import assert from 'assert'
import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import {
  isNotFoundPost,
  isThreadViewPost,
} from '../../src/lexicon/types/app/bsky/feed/defs'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('views with interaction gating', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_gating',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('applies gate for empty rules.', async () => {
    const post = await sc.post(sc.dids.carol, 'empty rules')
    await pdsAgent.api.app.bsky.feed.gate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      { post: post.ref.uriStr, createdAt: iso(), allow: [] },
      sc.getHeaders(sc.dids.carol),
    )
    await sc.reply(sc.dids.alice, post.ref, post.ref, 'empty rules reply')
    await network.processAll()
    const {
      data: { thread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )
    assert(isThreadViewPost(thread))
    expect(thread.post.gate).toMatchSnapshot()
    expect(thread.viewer).toEqual({ canReply: false })
    expect(thread.replies?.length).toEqual(0)
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
    await pdsAgent.api.app.bsky.feed.gate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      {
        post: post.ref.uriStr,
        createdAt: iso(),
        allow: [{ $type: 'app.bsky.feed.gate#mentionRule' }],
      },
      sc.getHeaders(sc.dids.carol),
    )
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
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )
    assert(isThreadViewPost(aliceThread))
    expect(aliceThread.viewer).toEqual({ canReply: false })
    const {
      data: { thread: danThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      { headers: await network.serviceHeaders(sc.dids.dan) },
    )
    assert(isThreadViewPost(danThread))
    expect(danThread.post.gate).toMatchSnapshot()
    expect(danThread.viewer).toEqual({ canReply: true })
    const [reply, ...otherReplies] = danThread.replies ?? []
    assert(isThreadViewPost(reply))
    expect(otherReplies.length).toEqual(0)
    expect(reply.post.uri).toEqual(danReply.ref.uriStr)
  })

  it('applies gate for following rule.', async () => {
    const post = await sc.post(sc.dids.carol, 'following rule')
    await pdsAgent.api.app.bsky.feed.gate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      {
        post: post.ref.uriStr,
        createdAt: iso(),
        allow: [{ $type: 'app.bsky.feed.gate#followingRule' }],
      },
      sc.getHeaders(sc.dids.carol),
    )
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
      { headers: await network.serviceHeaders(sc.dids.dan) },
    )
    assert(isThreadViewPost(danThread))
    expect(danThread.viewer).toEqual({ canReply: false })
    const {
      data: { thread: aliceThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )
    assert(isThreadViewPost(aliceThread))
    expect(aliceThread.post.gate).toMatchSnapshot()
    expect(aliceThread.viewer).toEqual({ canReply: true })
    const [reply, ...otherReplies] = aliceThread.replies ?? []
    assert(isThreadViewPost(reply))
    expect(otherReplies.length).toEqual(0)
    expect(reply.post.uri).toEqual(aliceReply.ref.uriStr)
  })

  it('applies gate for list rule.', async () => {})

  it('applies gate for multiple rules.', async () => {
    const post = await sc.post(sc.dids.carol, 'multi rules @dan.test', [
      {
        index: { byteStart: 12, byteEnd: 21 },
        features: [
          { $type: 'app.bsky.richtext.facet#mention', did: sc.dids.dan },
        ],
      },
    ])
    await pdsAgent.api.app.bsky.feed.gate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      {
        post: post.ref.uriStr,
        createdAt: iso(),
        allow: [
          { $type: 'app.bsky.feed.gate#mentionRule' },
          { $type: 'app.bsky.feed.gate#followingRule' },
        ],
      },
      sc.getHeaders(sc.dids.carol),
    )
    // carol only follows alice, and the post mentions dan.
    await sc.reply(sc.dids.bob, post.ref, post.ref, 'multi rule reply disallow')
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
      data: { thread: bobThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      { headers: await network.serviceHeaders(sc.dids.bob) },
    )
    assert(isThreadViewPost(bobThread))
    expect(bobThread.viewer).toEqual({ canReply: false })
    const {
      data: { thread: aliceThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )
    assert(isThreadViewPost(aliceThread))
    expect(aliceThread.viewer).toEqual({ canReply: true })
    const {
      data: { thread: danThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr },
      { headers: await network.serviceHeaders(sc.dids.dan) },
    )
    assert(isThreadViewPost(danThread))
    expect(danThread.post.gate).toMatchSnapshot()
    expect(danThread.viewer).toEqual({ canReply: true })
    const [reply1, reply2, ...otherReplies] = aliceThread.replies ?? []
    assert(isThreadViewPost(reply1))
    assert(isThreadViewPost(reply2))
    expect(otherReplies.length).toEqual(0)
    expect(reply1.post.uri).toEqual(danReply.ref.uriStr)
    expect(reply2.post.uri).toEqual(aliceReply.ref.uriStr)
  })

  it('applies gate for missing rules, takes no action.', async () => {
    const post = await sc.post(sc.dids.carol, 'missing rules')
    await pdsAgent.api.app.bsky.feed.gate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      { post: post.ref.uriStr, createdAt: iso() },
      sc.getHeaders(sc.dids.carol),
    )
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
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )
    assert(isThreadViewPost(thread))
    expect(thread.post.gate).toMatchSnapshot()
    expect(thread.viewer).toEqual({ canReply: true })
    const [reply, ...otherReplies] = thread.replies ?? []
    assert(isThreadViewPost(reply))
    expect(otherReplies.length).toEqual(0)
    expect(reply.post.uri).toEqual(aliceReply.ref.uriStr)
  })

  it('applies gate after root post is deleted.', async () => {
    // @NOTE also covers rule application more than one level deep
    const post = await sc.post(sc.dids.carol, 'following rule w/ post deletion')
    await pdsAgent.api.app.bsky.feed.gate.create(
      { repo: sc.dids.carol, rkey: post.ref.uri.rkey },
      {
        post: post.ref.uriStr,
        createdAt: iso(),
        allow: [{ $type: 'app.bsky.feed.gate#followingRule' }],
      },
      sc.getHeaders(sc.dids.carol),
    )
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
      { headers: await network.serviceHeaders(sc.dids.dan) },
    )
    assert(isThreadViewPost(danThread))
    expect(danThread.viewer).toEqual({ canReply: false })
    const {
      data: { thread: aliceThread },
    } = await agent.api.app.bsky.feed.getPostThread(
      { uri: orphanedReply.ref.uriStr },
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )
    assert(isThreadViewPost(aliceThread))
    assert(
      isNotFoundPost(aliceThread.parent) &&
        aliceThread.parent.uri === post.ref.uriStr,
    )
    expect(aliceThread.post.gate).toMatchSnapshot()
    expect(aliceThread.viewer).toEqual({ canReply: true })
    const [reply, ...otherReplies] = aliceThread.replies ?? []
    assert(isThreadViewPost(reply))
    expect(otherReplies.length).toEqual(0)
    expect(reply.post.uri).toEqual(aliceReply.ref.uriStr)
  })

  it('does not apply gate to original poster.', async () => {})

  it('displays gated posts not in the context of a reply.', async () => {
    // in author feed
    // in post thread at depth 0
  })

  // @TODO check inner post uri value
  it('does not apply gate unless it matches post rkey.', async () => {})
})

const iso = (date = new Date()) => date.toISOString()
