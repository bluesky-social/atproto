import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { forSnapshot } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds profile proxy views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_profile',
    })
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await network.close()
  })

  it('fetches own profile', async () => {
    const aliceForAlice = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it("fetches other's profile, with a follow", async () => {
    const aliceForBob = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(aliceForBob.data)).toMatchSnapshot()
  })

  it("fetches other's profile, without a follow", async () => {
    const danForBob = await agent.api.app.bsky.actor.getProfile(
      { actor: dan },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(danForBob.data)).toMatchSnapshot()
  })

  it('fetches multiple profiles', async () => {
    const {
      data: { profiles },
    } = await agent.api.app.bsky.actor.getProfiles(
      {
        actors: [
          alice,
          'bob.test',
          'did:example:missing',
          'carol.test',
          dan,
          'missing.test',
        ],
      },
      { headers: sc.getHeaders(bob) },
    )

    expect(profiles.map((p) => p.handle)).toEqual([
      'alice.test',
      'bob.test',
      'carol.test',
      'dan.test',
    ])

    expect(forSnapshot(profiles)).toMatchSnapshot()
  })

  it('fetches profile by handle', async () => {
    const byDid = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      {
        headers: sc.getHeaders(bob),
      },
    )

    const byHandle = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.accounts[alice].handle },
      { headers: sc.getHeaders(bob) },
    )

    expect(byHandle.data).toEqual(byDid.data)
  })

  it('includes muted status.', async () => {
    const { data: initial } = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(bob) },
    )

    expect(initial.viewer?.muted).toEqual(false)

    await agent.api.app.bsky.graph.muteActor(
      { actor: alice },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
    const { data: muted } = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(bob) },
    )

    expect(muted.viewer?.muted).toEqual(true)

    const { data: fromBobUnrelated } =
      await agent.api.app.bsky.actor.getProfile(
        { actor: dan },
        { headers: sc.getHeaders(bob) },
      )
    const { data: toAliceUnrelated } =
      await agent.api.app.bsky.actor.getProfile(
        { actor: alice },
        { headers: sc.getHeaders(dan) },
      )

    expect(fromBobUnrelated.viewer?.muted).toEqual(false)
    expect(toAliceUnrelated.viewer?.muted).toEqual(false)

    await agent.api.app.bsky.graph.unmuteActor(
      { actor: alice },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
  })
})
