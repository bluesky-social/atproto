import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('bsky actor likes feed views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_actor_likes',
    })
    agent = network.bsky.getClient()
    const pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await network.close()
  })

  it('returns posts liked by actor', async () => {
    const {
      data: { feed: bobLikes },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[bob].handle },
      { headers: await network.serviceHeaders(bob) },
    )

    expect(bobLikes).toHaveLength(3)

    const {
      data: { feed: carolLikes },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[carol].handle },
      { headers: await network.serviceHeaders(carol) },
    )

    expect(carolLikes).toHaveLength(2)

    const {
      data: { feed: aliceLikes },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[alice].handle },
      { headers: await network.serviceHeaders(alice) },
    )

    expect(aliceLikes).toHaveLength(1)

    const {
      data: { feed: danLikes },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[dan].handle },
      { headers: await network.serviceHeaders(dan) },
    )

    expect(danLikes).toHaveLength(1)
  })
})
