import AtpAgent, { AtUri } from '@atproto/api'
import { runTestServer, TestServerInfo } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { makeAlgos } from '../../src'

describe.skip('algo hot-classic', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string

  const feedPublisherDid = 'did:example:feed-publisher'
  const feedUri = AtUri.make(
    feedPublisherDid,
    'app.bsky.feed.generator',
    'hot-classic',
  ).toString()

  beforeAll(async () => {
    server = await runTestServer(
      {
        dbPostgresSchema: 'algo_hot_classic',
      },
      {
        algos: makeAlgos(feedPublisherDid),
      },
    )
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)

    alice = sc.dids.alice
    bob = sc.dids.bob
    await server.processAll()
  })

  afterAll(async () => {
    await server.close()
  })

  it('returns well liked posts', async () => {
    const img = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-landscape-small.jpg',
      'image/jpeg',
    )
    const one = await sc.post(alice, 'first post', undefined, [img])
    const two = await sc.post(bob, 'bobby boi')
    const three = await sc.reply(bob, one.ref, one.ref, 'reply')

    for (let i = 0; i < 12; i++) {
      const name = `user${i}`
      await sc.createAccount(name, {
        handle: `user${i}.test`,
        email: `user${i}@test.com`,
        password: 'password',
      })
      await sc.like(sc.dids[name], one.ref)
      await sc.like(sc.dids[name], two.ref)
      await sc.like(sc.dids[name], three.ref)
    }
    await server.processAll()

    const res = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri },
      { headers: sc.getHeaders(alice) },
    )
    const feedUris = res.data.feed.map((i) => i.post.uri).sort()
    const expected = [one.ref.uriStr, two.ref.uriStr].sort()
    expect(feedUris).toEqual(expected)
  })

  it('paginates', async () => {
    const res = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri },
      { headers: sc.getHeaders(alice) },
    )
    const first = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri, limit: 1 },
      { headers: sc.getHeaders(alice) },
    )
    const second = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri, cursor: first.data.cursor },
      { headers: sc.getHeaders(alice) },
    )

    expect([...first.data.feed, ...second.data.feed]).toEqual(res.data.feed)
  })
})
