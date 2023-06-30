import { HOUR } from '@atproto/common'
import AtpAgent, { AtUri } from '@atproto/api'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { makeAlgos } from '../../src'
import { TestNetwork } from '@atproto/dev-env'

describe('algo whats-hot', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string

  const feedPublisherDid = 'did:example:feed-publisher'
  const feedUri = AtUri.make(
    feedPublisherDid,
    'app.bsky.feed.generator',
    'whats-hot',
  ).toString()

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_algo_whats_hot',
      bsky: { algos: makeAlgos(feedPublisherDid) },
    })
    agent = new AtpAgent({ service: network.bsky.url })
    const pdsAgent = new AtpAgent({ service: network.pds.url })
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)

    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    await network.processAll()
    await network.bsky.ctx.backgroundQueue.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('returns well liked posts', async () => {
    const img = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-landscape-small.jpg',
      'image/jpeg',
    )
    const one = await sc.post(carol, 'carol is in the chat')
    const two = await sc.post(carol, "it's me, carol")
    const three = await sc.post(alice, 'first post', undefined, [img])
    const four = await sc.post(bob, 'bobby boi')
    const five = await sc.post(bob, 'another one')

    for (let i = 0; i < 20; i++) {
      const name = `user${i}`
      await sc.createAccount(name, {
        handle: `user${i}.test`,
        email: `user${i}@test.com`,
        password: 'password',
      })
      await sc.like(sc.dids[name], three.ref) // will be down-regulated by time
      if (i > 3) {
        await sc.like(sc.dids[name], one.ref)
      }
      if (i > 5) {
        await sc.like(sc.dids[name], two.ref)
      }
      if (i > 7) {
        await sc.like(sc.dids[name], four.ref)
        await sc.like(sc.dids[name], five.ref)
      }
    }
    await network.bsky.ctx.backgroundQueue.processAll()

    // move the 3rd post 5 hours into the past to check gravity
    await network.bsky.ctx.db.db
      .updateTable('post')
      .where('uri', '=', three.ref.uriStr)
      .set({ indexedAt: new Date(Date.now() - 5 * HOUR).toISOString() })
      .execute()

    await network.bsky.ctx.db.refreshMaterializedView('algo_whats_hot_view')

    const res = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri },
      { headers: await network.serviceHeaders(alice) },
    )
    expect(res.data.feed[0].post.uri).toBe(one.ref.uriStr)
    expect(res.data.feed[1].post.uri).toBe(two.ref.uriStr)
    const indexOfThird = res.data.feed.findIndex(
      (item) => item.post.uri === three.ref.uriStr,
    )
    // doesn't quite matter where this cam in but it should be down-regulated pretty severely from gravity
    expect(indexOfThird).toBeGreaterThan(3)
  })

  it('paginates', async () => {
    const res = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri },
      { headers: await network.serviceHeaders(alice) },
    )
    const first = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri, limit: 3 },
      { headers: await network.serviceHeaders(alice) },
    )
    const second = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri, cursor: first.data.cursor },
      { headers: await network.serviceHeaders(alice) },
    )

    expect([...first.data.feed, ...second.data.feed]).toEqual(res.data.feed)
  })
})
