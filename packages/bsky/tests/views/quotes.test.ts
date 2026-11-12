import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type AtpAgent, ids } from '@atproto/api'
import { type SeedClient, TestNetwork, quotesSeed } from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
import { forSnapshot } from '../_util.js'

describe('pds quote views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: DidString
  let bob: DidString
  let carol: DidString
  let eve: DidString

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_quotes',
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await quotesSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    eve = sc.dids.eve
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

  it('fetches post quotes', async () => {
    const alicePostQuotes = await agent.api.app.bsky.feed.getQuotes(
      { uri: sc.posts[alice][0].ref.uriStr, limit: 30 },
      { headers: await network.serviceHeaders(eve, ids.AppBskyFeedGetQuotes) },
    )

    expect(alicePostQuotes.data.posts.length).toBe(2)
    expect(forSnapshot(alicePostQuotes.data)).toMatchSnapshot()
  })

  it('forwards sort to the dataplane', async () => {
    const client = network.bsky.ctx.hydrator.dataplane
    const original = client.getQuotesBySubjectSorted
    // Connect client methods are typed readonly; reassign through a mutable view.
    const dataplane = client as {
      getQuotesBySubjectSorted: typeof original
    }
    const requests: { sort?: string }[] = []
    dataplane.getQuotesBySubjectSorted = ((req, opts) => {
      requests.push(req)
      return original.call(client, req, opts)
    }) as typeof original
    try {
      const headers = await network.serviceHeaders(
        eve,
        ids.AppBskyFeedGetQuotes,
      )
      const uri = sc.posts[alice][1].ref.uriStr
      await agent.api.app.bsky.feed.getQuotes({ uri, sort: 'top' }, { headers })
      expect(requests.at(-1)?.sort).toBe('top')

      await agent.api.app.bsky.feed.getQuotes({ uri }, { headers })
      expect(requests.at(-1)?.sort ?? '').toBe('')
    } finally {
      dataplane.getQuotesBySubjectSorted = original
    }
  })

  it('accepts sort=top against the local dataplane', async () => {
    const headers = await network.serviceHeaders(eve, ids.AppBskyFeedGetQuotes)
    const uri = sc.posts[alice][1].ref.uriStr
    const unsorted = await agent.api.app.bsky.feed.getQuotes(
      { uri },
      { headers },
    )
    const top = await agent.api.app.bsky.feed.getQuotes(
      { uri, sort: 'top' },
      { headers },
    )
    expect(top.success).toBe(true)
    expect(top.data.posts.length).toBeGreaterThan(0)
    expect(top.data.posts.map((p) => p.uri)).toEqual(
      unsorted.data.posts.map((p) => p.uri),
    )
  })

  it('does not return post in list when the quote author has a block', async () => {
    await sc.block(eve, carol)
    await network.processAll()

    const quotes = await agent.api.app.bsky.feed.getQuotes(
      { uri: sc.posts[alice][0].ref.uriStr, limit: 30 },
      {
        headers: await network.serviceHeaders(carol, ids.AppBskyFeedGetQuotes),
      },
    )

    expect(quotes.data.posts.length).toBe(0)
    await sc.unblock(eve, carol)
  })

  it('utilizes limit parameter and cursor', async () => {
    const alicePostQuotes1 = await agent.api.app.bsky.feed.getQuotes(
      { uri: sc.posts[alice][1].ref.uriStr, limit: 3 },
      { headers: await network.serviceHeaders(eve, ids.AppBskyFeedGetQuotes) },
    )

    expect(alicePostQuotes1.data.posts.length).toBe(3)
    expect(alicePostQuotes1.data.cursor).toBeDefined()

    const alicePostQuotes2 = await agent.api.app.bsky.feed.getQuotes(
      {
        uri: sc.posts[alice][1].ref.uriStr,
        limit: 3,
        cursor: alicePostQuotes1.data.cursor,
      },
      { headers: await network.serviceHeaders(eve, ids.AppBskyFeedGetQuotes) },
    )

    expect(alicePostQuotes2.data.posts.length).toBe(2)
    expect(alicePostQuotes2.data.cursor).toBeUndefined()

    const exact = await network.bsky.ctx.dataplane.getQuotesBySubjectSorted({
      subject: { uri: sc.posts[alice][1].ref.uriStr },
      limit: 5,
    })
    const nonterminal =
      await network.bsky.ctx.dataplane.getQuotesBySubjectSorted({
        subject: { uri: sc.posts[alice][1].ref.uriStr },
        limit: 3,
      })
    expect(exact.uris).toHaveLength(5)
    expect(exact.cursor).toBe('')
    expect(nonterminal.uris).toHaveLength(3)
    expect(nonterminal.cursor).not.toBe('')
  })

  it('fills a limited quotes page after an entirely filtered page', async () => {
    const subject = await sc.post(alice, 'quote page fill subject')
    const older = await sc.post(
      bob,
      'older visible quote',
      undefined,
      undefined,
      subject.ref,
      { createdAt: '2030-04-01T00:00:00.000Z' },
    )
    const newer = await sc.post(
      carol,
      'newer visible quote',
      undefined,
      undefined,
      subject.ref,
      { createdAt: '2030-04-02T00:00:00.000Z' },
    )
    await sc.post(
      sc.dids.dan,
      'filtered quote 1',
      undefined,
      undefined,
      subject.ref,
      { createdAt: '2030-04-03T00:00:00.000Z' },
    )
    await sc.post(eve, 'filtered quote 2', undefined, undefined, subject.ref, {
      createdAt: '2030-04-04T00:00:00.000Z',
    })
    await sc.block(sc.dids.dan, alice)
    await sc.block(eve, alice)
    await network.processAll()

    const { data } = await agent.api.app.bsky.feed.getQuotes(
      { uri: subject.ref.uriStr, limit: 2 },
      {
        headers: await network.serviceHeaders(alice, ids.AppBskyFeedGetQuotes),
      },
    )

    expect(data.posts.map((post) => post.uri)).toEqual([
      newer.ref.uriStr,
      older.ref.uriStr,
    ])
    expect(data.cursor).toBeUndefined()

    await sc.unblock(sc.dids.dan, alice)
    await sc.unblock(eve, alice)
  })

  it('does not return post when quote is deleted', async () => {
    await sc.deletePost(eve, sc.posts[eve][0].ref.uri)
    await network.processAll()

    const alicePostQuotes = await agent.api.app.bsky.feed.getQuotes(
      { uri: sc.posts[alice][0].ref.uriStr, limit: 30 },
      {
        headers: await network.serviceHeaders(alice, ids.AppBskyFeedGetQuotes),
      },
    )

    expect(alicePostQuotes.data.posts.length).toBe(1)
    expect(forSnapshot(alicePostQuotes.data)).toMatchSnapshot()
  })

  it('does not return any quotes when the quoted post is deleted', async () => {
    await sc.deletePost(alice, sc.posts[alice][0].ref.uri)
    await network.processAll()

    const alicePostQuotesAfter = await agent.api.app.bsky.feed.getQuotes(
      { uri: sc.posts[alice][0].ref.uriStr, limit: 30 },
      {
        headers: await network.serviceHeaders(alice, ids.AppBskyFeedGetQuotes),
      },
    )

    expect(alicePostQuotesAfter.data.posts.length).toBe(0)
  })

  it('decrements quote count when a quote is deleted', async () => {
    await sc.deletePost(eve, sc.posts[eve][2].ref.uri)
    await network.processAll()

    const bobPost = await agent.api.app.bsky.feed.getPosts(
      { uris: [sc.replies[bob][0].ref.uriStr] },
      { headers: await network.serviceHeaders(bob, ids.AppBskyFeedGetPosts) },
    )

    expect(bobPost.data.posts[0].quoteCount).toEqual(0)
    expect(forSnapshot(bobPost.data)).toMatchSnapshot()
  })

  it('does not return post in list when the embed is blocked', async () => {
    await sc.block(carol, eve)
    await network.processAll()

    const quotes = await agent.api.app.bsky.feed.getQuotes(
      { uri: sc.posts[carol][1].ref.uriStr },
      { headers: await network.serviceHeaders(bob, ids.AppBskyFeedGetQuotes) },
    )

    expect(quotes.data.posts.length).toBe(0)
  })
})
