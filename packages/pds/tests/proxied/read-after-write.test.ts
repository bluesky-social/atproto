import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('proxy read after write', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_read_after_write',
    })
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
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

  it('handles read after write on profiles', async () => {
    await network.bsky.sub.destroy()
    await sc.updateProfile(alice, { displayName: 'blah' })
    const res = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' } },
    )
    expect(res.data.displayName).toEqual('blah')
    expect(res.data.description).toBeUndefined()
  })
})
