import { AtpAgent } from '@atproto/api'
import { TestNetwork, SeedClient, usersSeed } from '@atproto/dev-env'
import { forSnapshot } from '../_util'

describe('vouches', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_vouches',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await usersSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    await network.processAll()
  })

  beforeAll(async () => {
    const bobVouch = await sc.vouch(bob, alice, 'verifiedBy')
    await sc.acceptVouch(alice, bobVouch)
    const carolVouch = await sc.vouch(carol, alice, 'friendOf')
    await sc.acceptVouch(alice, carolVouch)
    await sc.vouch(dan, alice, 'colleagueOf')

    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('fetches vouches for a user', async () => {
    const res = await agent.app.bsky.graph.getVouchesReceived({ actor: alice })
    expect(res.data.vouches.length).toBe(2)
    expect(forSnapshot(res.data.vouches)).toMatchSnapshot()

    // does not return unaccepted vouches
    expect(res.data.vouches.some((v) => v.creator.did === dan)).toBe(false)
  })
})
