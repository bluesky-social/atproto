import AtpAgent from '@atproto/api'
import { SeedClient, TestNetwork, quotesSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { forSnapshot } from '../_util'

describe('pds quote views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let eve: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_quotes',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await quotesSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    eve = sc.dids.eve
  })

  afterAll(async () => {
    await network.close()
  })

  it('fetches post quotes', async () => {
    const alicePostQuotes = await agent.api.app.bsky.feed.getQuotes(
      { uri: sc.posts[alice][0].ref.uriStr, limit: 30 },
      { headers: await network.serviceHeaders(eve, ids.AppBskyFeedGetQuotes) },
    )

    expect(alicePostQuotes.data.posts.length).toBe(2)
    expect(forSnapshot(alicePostQuotes.data)).toMatchSnapshot()
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
