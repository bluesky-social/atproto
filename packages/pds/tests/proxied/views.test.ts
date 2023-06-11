import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { forSnapshot } from '../_util'

describe('proxies requests', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_feedgen',
    })
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('proxies views', async () => {
    const res = await agent.api.app.bsky.actor.getProfile(
      {
        actor: sc.dids.alice,
      },
      {
        headers: { ...sc.getHeaders(sc.dids.alice), 'x-appview-proxy': 'true' },
      },
    )
  })
})
