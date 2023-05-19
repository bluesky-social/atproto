import AtpAgent, { AtUri } from '@atproto/api'
import { runTestServer, TestServerInfo } from '../_util'
import { SeedClient } from '../seeds/client'
import userSeed from '../seeds/users'
import { makeAlgos } from '../../src'

describe('algo with friends', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  const feedPublisherDid = 'did:example:feed-publisher'
  const feedUri = AtUri.make(
    feedPublisherDid,
    'app.bsky.feed.generator',
    'with-friends',
  ).toString()

  beforeAll(async () => {
    server = await runTestServer(
      {
        dbPostgresSchema: 'algo_with_friends',
      },
      {
        algos: makeAlgos(feedPublisherDid),
      },
    )
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await userSeed(sc)

    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan

    await server.ctx.backgroundQueue.processAll()
  })

  afterAll(async () => {
    await server.close()
  })

  let expectedFeed: string[]

  it('setup', async () => {
    for (let i = 0; i < 4; i++) {
      const name = `user${i}`
      await sc.createAccount(name, {
        handle: `user${i}.test`,
        email: `user${i}@test.com`,
        password: 'password',
      })
    }

    await sc.follow(alice, bob)
    await sc.follow(alice, carol)
    const one = await sc.post(bob, 'one')
    const two = await sc.post(bob, 'two')
    const three = await sc.post(carol, 'three')
    const four = await sc.post(carol, 'four')
    const five = await sc.post(dan, 'five')
    const six = await sc.post(dan, 'six')

    // in-network post with threshold in-network likes
    await sc.like(bob, one.ref)
    await sc.like(carol, one.ref)
    await sc.like(dan, one.ref)

    // in-network post with threshold likes
    await sc.like(carol, two.ref)
    await sc.like(dan, two.ref)

    // in-network post without threshold likes
    await sc.like(bob, three.ref)

    // in-network post with no in-network likes but threshold likes
    await sc.like(sc.dids.user0, four.ref)
    await sc.like(sc.dids.user1, four.ref)
    await sc.like(sc.dids.user2, four.ref)
    await sc.like(sc.dids.user3, four.ref)

    // out-network post with threshold in-network likes
    await sc.like(bob, five.ref)
    await sc.like(carol, five.ref)

    // out-network post with many likes but not in-network threshold
    await sc.like(sc.dids.user0, six.ref)
    await sc.like(sc.dids.user1, six.ref)
    await sc.like(sc.dids.user2, six.ref)
    await sc.like(sc.dids.user3, six.ref)

    expectedFeed = [
      five.ref.uriStr,
      four.ref.uriStr,
      two.ref.uriStr,
      one.ref.uriStr,
    ]
  })

  it('returns popular in & out of network posts', async () => {
    const res = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri },
      { headers: sc.getHeaders(alice) },
    )
    const feedUris = res.data.feed.map((i) => i.post.uri)
    expect(feedUris).toEqual(expectedFeed)
  })

  it('paginates', async () => {
    const res = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri },
      { headers: sc.getHeaders(alice) },
    )
    const first = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri, limit: 2 },
      { headers: sc.getHeaders(alice) },
    )
    const second = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri, cursor: first.data.cursor },
      { headers: sc.getHeaders(alice) },
    )

    expect([...first.data.feed, ...second.data.feed]).toEqual(res.data.feed)
  })
})
