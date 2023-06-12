import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { forSnapshot } from '../_util'

describe('proxies requests', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let alice: string
  let bob: string
  let carol: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_feedgen',
    })
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
  })

  afterAll(async () => {
    await network.close()
  })

  it('actor.getProfile', async () => {
    const res1 = await agent.api.app.bsky.actor.getProfile(
      {
        actor: alice,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    const res2 = await agent.api.app.bsky.actor.getProfile(
      {
        actor: alice,
      },
      {
        headers: { ...sc.getHeaders(alice) },
      },
    )
    expect(forSnapshot(res1.data, true)).toEqual(forSnapshot(res2.data, true))
  })

  it('actor.getProfiles', async () => {
    const res1 = await agent.api.app.bsky.actor.getProfiles(
      {
        actors: [alice, bob],
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    const res2 = await agent.api.app.bsky.actor.getProfiles(
      {
        actors: [alice, bob],
      },
      {
        headers: { ...sc.getHeaders(alice) },
      },
    )
    expect(forSnapshot(res1.data, true)).toEqual(forSnapshot(res2.data, true))
  })

  it('feed.getAuthorFeed', async () => {
    const res1 = await agent.api.app.bsky.feed.getAuthorFeed(
      {
        actor: bob,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    const res2 = await agent.api.app.bsky.feed.getAuthorFeed(
      {
        actor: bob,
      },
      {
        headers: { ...sc.getHeaders(alice) },
      },
    )
    expect(forSnapshot(res1.data, true)).toEqual(forSnapshot(res2.data, true))
  })

  it('feed.getTimeline', async () => {
    const res1 = await agent.api.app.bsky.feed.getTimeline(
      {},
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    const res2 = await agent.api.app.bsky.feed.getTimeline(
      {},
      {
        headers: { ...sc.getHeaders(alice) },
      },
    )
    expect(forSnapshot(res1.data, true)).toEqual(forSnapshot(res2.data, true))
  })
})
