import { quotesSeed, SeedClient, TestNetwork } from '@atproto/dev-env'
import AtpAgent, { AtUri } from '@atproto/api'
import { forSnapshot } from '../_util'

describe('pds quote views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
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
    eve = sc.dids.eve
  })

  afterAll(async () => {
    await network.close()
  })

  it('fetches post quotes', async () => {
    const alicePostQuotes = await agent.api.app.bsky.feed.getQuotes(
      { uri: sc.posts[alice][0].ref.uriStr, limit: 30 },
      { headers: await network.serviceHeaders(eve) },
    )

    expect(alicePostQuotes.data.posts.length).toBe(2)
    expect(forSnapshot(alicePostQuotes.data)).toMatchSnapshot()
  })

  it('utilizes limit parameter and cursor', async () => {
    const alicePostQuotes1 = await agent.api.app.bsky.feed.getQuotes(
      { uri: sc.posts[alice][1].ref.uriStr, limit: 30 },
      { headers: await network.serviceHeaders(eve) },
    )

    expect(alicePostQuotes1.data.posts.length).toBe(30)
    expect(alicePostQuotes1.data.cursor).toBeDefined()

    const alicePostQuotes2 = await agent.api.app.bsky.feed.getQuotes(
      {
        uri: sc.posts[alice][1].ref.uriStr,
        limit: 30,
        cursor: alicePostQuotes1.data.cursor,
      },
      { headers: await network.serviceHeaders(eve) },
    )

    expect(alicePostQuotes2.data.posts.length).toBe(20)
  })

  it('does not return post when quote is deleted', async () => {
    await sc.deletePost(eve, sc.posts[eve][0].ref.uri)
    await network.processAll(1000)

    const alicePostQuotes = await agent.api.app.bsky.feed.getQuotes(
      { uri: sc.posts[alice][0].ref.uriStr, limit: 30 },
      { headers: await network.serviceHeaders(alice) },
    )

    expect(alicePostQuotes.data.posts.length).toBe(1)
    expect(forSnapshot(alicePostQuotes.data)).toMatchSnapshot()
  })

  it('does not return any quotes when the quoted post is deleted', async () => {
    await sc.deletePost(alice, sc.posts[alice][0].ref.uri)
    await network.processAll(1000)

    const alicePostQuotesAfter = await agent.api.app.bsky.feed.getQuotes(
      { uri: sc.posts[alice][0].ref.uriStr, limit: 30 },
      { headers: await network.serviceHeaders(alice) },
    )

    expect(alicePostQuotesAfter.data.posts.length).toBe(0)
  })

  it('decrements quote count when a quote is deleted', async () => {
    await sc.deletePost(eve, sc.posts[eve][2].ref.uri)
    await network.processAll(1000)

    const bobPost = await agent.api.app.bsky.feed.getPosts(
      { uris: [sc.replies[bob][0].ref.uriStr] },
      { headers: await network.serviceHeaders(bob) },
    )

    expect(bobPost.data.posts[0].quoteCount).toEqual(0)
    expect(forSnapshot(bobPost.data)).toMatchSnapshot()
  })
})
