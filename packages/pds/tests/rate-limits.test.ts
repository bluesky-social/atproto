import { AtpAgent } from '@atproto/api'
import { randomStr } from '@atproto/crypto'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { buildRateLimitsConfig } from '../src/rate-limits.js'
import userSeed from './seeds/basic.js'

describe('rate limits', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient
  let alice: string
  let bob: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'rate_limits',
      pds: {
        redisScratchAddress: process.env.REDIS_HOST,
        redisScratchPassword: process.env.REDIS_PASSWORD,
        rateLimitsEnabled: true,
      },
    })
    agent = network.pds.getAgent()
    sc = network.getSeedClient()
    await userSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  afterAll(async () => {
    await network.close()
  })

  it('rate limits by ip', async () => {
    const attempt = () =>
      agent.api.com.atproto.server.resetPassword({
        token: randomStr(4, 'base32'),
        password: 'asdf1234',
      })
    for (let i = 0; i < 50; i++) {
      try {
        await attempt()
      } catch (err) {
        // do nothing
      }
    }
    await expect(attempt).rejects.toThrow('Rate Limit Exceeded')
  })

  it('rate limits by a custom key', async () => {
    const attempt = () =>
      agent.api.com.atproto.server.createSession({
        identifier: sc.accounts[alice].handle,
        password: 'asdf1234',
      })
    for (let i = 0; i < 30; i++) {
      try {
        await attempt()
      } catch (err) {
        // do nothing
      }
    }
    await expect(attempt).rejects.toThrow('Rate Limit Exceeded')

    // does not rate limit for another key
    await agent.api.com.atproto.server.createSession({
      identifier: sc.accounts[bob].handle,
      password: sc.accounts[bob].password,
    })
  })

  it('uses a higher ip rate limit for sync.getRepo only', () => {
    const rateLimits = buildRateLimitsConfig({
      enabled: true,
      bypassKey: undefined,
      bypassIps: undefined,
    })
    if (!rateLimits?.global || !rateLimits.shared) {
      throw new Error('expected rate limits to be configured')
    }

    expect(rateLimits.global).toHaveLength(1)
    expect(rateLimits.global[0]?.name).toBe('global-ip')
    expect(rateLimits.global[0]?.points).toBe(3000)
    expect(rateLimits.global[0]?.calcKey?.({
      req: {
        path: '/xrpc/com.atproto.sync.getRepo',
        ip: '192.0.2.1',
      },
    } as never)).toBeNull()
    expect(rateLimits.global[0]?.calcKey?.({
      req: {
        path: '/xrpc/com.atproto.sync.getRecord',
        ip: '192.0.2.1',
      },
    } as never)).toBe('192.0.2.1')

    expect(rateLimits.shared).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'sync-get-repo-ip',
          durationMs: 5 * 60 * 1000,
          points: 6000,
        }),
      ]),
    )
  })
})
