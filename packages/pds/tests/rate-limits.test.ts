import { Redis } from 'ioredis'
import type { AtpAgent } from '@atproto/api'
import { randomStr } from '@atproto/crypto'
import { type SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { buildOAuthRateLimiterFactory } from '../src/rate-limits.js'
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
    await network?.close()
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
})

describe('oauth rate limiter factory', () => {
  const options = { points: 2, durationMs: 60_000 }

  it('reports exceeded limits as negative remaining points, without throwing', async () => {
    const limiter = buildOAuthRateLimiterFactory()({
      name: 'test-exceed',
      ...options,
    })

    await expect(limiter.consume('k', 1)).resolves.toMatchObject({
      remainingPoints: 1,
    })
    // Last allowed point
    await expect(limiter.consume('k', 1)).resolves.toMatchObject({
      remainingPoints: 0,
    })

    const result = await limiter.consume('k', 1)
    expect(result.remainingPoints).toBe(-1)
    expect(result.msBeforeNext).toBeGreaterThan(0)
    expect(result.msBeforeNext).toBeLessThanOrEqual(options.durationMs)

    // Other keys are not affected
    await expect(limiter.consume('other', 1)).resolves.toMatchObject({
      remainingPoints: 1,
    })
  })

  it('fails open when the backend fails', async () => {
    // Unreachable, and rejecting commands instead of queuing them
    const redis = new Redis({
      port: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
    })

    try {
      const limiter = buildOAuthRateLimiterFactory(redis)({
        name: 'test-failure',
        ...options,
      })

      for (let i = 0; i < 5; i++) {
        await expect(limiter.consume('k', 1)).resolves.toEqual({
          remainingPoints: 2,
          msBeforeNext: 0,
        })
      }
    } finally {
      redis.disconnect()
    }
  })
})
