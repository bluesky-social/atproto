import { AtpAgent } from '@atproto/api'
import { InvalidEmailError } from '@atproto/api/dist/client/types/app/bsky/unspecced/checkHandleAvailability'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'

describe('handle availability', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let alice: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_handle_availability',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('validation', () => {
    it('throws if email passed is invalid', async () => {
      await expect(
        agent.app.bsky.unspecced.checkHandleAvailability({
          handle: sc.accounts[alice].handle,
          email: 'not-an-email',
        }),
      ).rejects.toThrow(InvalidEmailError)
    })
  })

  describe('available handle', () => {
    it('returns available when trying a non-existing handle', async () => {
      const handle = 'a5cc0a41-f9a3-4351-b9ec-1462f255fb0a.test'
      const { data } = await agent.app.bsky.unspecced.checkHandleAvailability({
        handle,
      })

      expect(data.handle).toBe(handle)
      expect(data.result.$type).toBe(
        'app.bsky.unspecced.checkHandleAvailability#resultAvailable',
      )
    })
  })

  describe('unavailable handle', () => {
    it('returns unavailable when trying an existing handle', async () => {
      const { data } = await agent.app.bsky.unspecced.checkHandleAvailability({
        handle: sc.accounts[alice].handle,
      })

      expect(data.handle).toBe(sc.accounts[alice].handle)
      expect(data.result.$type).toBe(
        'app.bsky.unspecced.checkHandleAvailability#resultUnavailable',
      )
    })
  })
})
