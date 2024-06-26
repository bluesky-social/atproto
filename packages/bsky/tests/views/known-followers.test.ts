import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'

describe('known followers aka social proof', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_block',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    // add follows to ensure blocks work even w follows
    await sc.follow(carol, dan)
    await sc.follow(dan, carol)
    // dan blocks carol
    await pdsAgent.api.app.bsky.graph.block.create(
      { repo: dan },
      { createdAt: new Date().toISOString(), subject: carol },
      sc.getHeaders(dan),
    )
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('does not return knownFollowers for basic profile views', async () => {
    const { data } = await agent.api.app.bsky.graph.getFollows(
      { actor: carol },
      { headers: await network.serviceHeaders(alice) },
    )
    const follow = data.follows[0]

    expect(follow.viewer?.knownFollowers).toBeFalsy()
  })

  it('returns knownFollowers viewer data', async () => {
    const { data } = await agent.api.app.bsky.actor.getProfile(
      { actor: bob },
      { headers: await network.serviceHeaders(alice) },
    )

    const knownFollowers = data.viewer?.knownFollowers
    expect(knownFollowers?.count).toBe(1)
    expect(knownFollowers?.followers).toHaveLength(1)
    expect(knownFollowers?.followers[0].handle).toBe('dan.test')
  })

  it('getKnownFollowers works', async () => {
    const { data } = await agent.api.app.bsky.graph.getKnownFollowers(
      { actor: bob },
      { headers: await network.serviceHeaders(alice) },
    )

    expect(data.subject.did).toBe(bob)
    expect(data.followers.length).toBe(1)
    expect(data.followers[0].handle).toBe('dan.test')
  })

  it('returns knownFollowers with 1st-order blocks filtered', async () => {
    const { data } = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: await network.serviceHeaders(dan) },
    )

    const knownFollowers = data.viewer?.knownFollowers
    expect(knownFollowers?.count).toBe(2)
    expect(knownFollowers?.followers).toHaveLength(1)
  })

  it('returns knownFollowers with 2nd-order blocks filtered', async () => {
    const result = await agent.api.app.bsky.actor.getProfile(
      { actor: carol },
      { headers: await network.serviceHeaders(alice) },
    )

    const knownFollowers = result.data.viewer?.knownFollowers
    expect(knownFollowers?.count).toBe(2)
    expect(knownFollowers?.followers).toHaveLength(1)
  })

  it('returns knownFollowers with 2nd-order blocks filtered from getProfiles', async () => {
    const result = await agent.api.app.bsky.actor.getProfiles(
      { actors: [carol] },
      { headers: await network.serviceHeaders(alice) },
    )

    expect(result.data.profiles).toHaveLength(1)
    const profile = result.data.profiles[0]
    const knownFollowers = profile.viewer?.knownFollowers
    expect(knownFollowers?.count).toBe(2)
    expect(knownFollowers?.followers).toHaveLength(1)
  })
})
