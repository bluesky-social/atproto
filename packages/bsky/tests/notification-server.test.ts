import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'

describe('notification views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_notifications',
    })
    agent = network.bsky.getClient()
    const pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await network.processAll()
    await network.bsky.processAll()
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
  })

  describe('registerPushNotification', () => {
    it('registers push notification token and device at specified endpoint or appview', async () => {
      const res = await agent.api.app.bsky.unspecced.registerPushNotification(
        {
          platform: 'ios',
          token: '123',
          appId: 'xyz.blueskyweb.app',
          endpoint: 'app.bsky.unspecced.registerPushNotification',
        },
        {
          headers: await network.serviceHeaders(alice),
        },
      )
      expect(res.success).toEqual(true)
    })
  })
})
