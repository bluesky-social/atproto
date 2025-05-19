import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'

describe('get config', () => {
  describe('when live now is NOT configured', () => {
    let network: TestNetwork
    let agent: AtpAgent

    beforeAll(async () => {
      network = await TestNetwork.create({
        dbPostgresSchema: 'bsky_tests_live_now_config_off',
      })
      agent = network.bsky.getClient()

      await network.processAll()
    })

    afterAll(async () => {
      await network.close()
    })

    it('omits the live now config', async () => {
      const res = await agent.app.bsky.unspecced.getConfig()

      expect(res.data).not.toHaveProperty('liveNow')
    })
  })

  describe('when live now is configured', () => {
    const liveNowConfig = [
      {
        did: 'did:plc:asdf123',
        domains: ['example.com', 'atproto.com'],
      },
      {
        did: 'did:plc:sdfg234',
        domains: ['example.com'],
      },
    ]

    let network: TestNetwork
    let agent: AtpAgent

    beforeAll(async () => {
      network = await TestNetwork.create({
        dbPostgresSchema: 'bsky_tests_live_now_config_on',
        bsky: {
          liveNowConfig,
        },
      })
      agent = network.bsky.getClient()

      await network.processAll()
    })

    afterAll(async () => {
      await network.close()
    })

    it(`returns the config`, async () => {
      const res = await agent.app.bsky.unspecced.getConfig()

      expect(res.data.liveNow).toEqual(liveNowConfig)
    })
  })
})
