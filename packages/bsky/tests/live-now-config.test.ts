import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'

describe('live now config', () => {
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

    it(`does not set up the endpoint`, async () => {
      await expect(agent.app.bsky.unspecced.getLiveNowConfig()).rejects.toThrow(
        'XRPCNotSupported',
      )
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
      const res = await agent.app.bsky.unspecced.getLiveNowConfig()

      expect(res.data.config).toEqual(liveNowConfig)
    })
  })
})
