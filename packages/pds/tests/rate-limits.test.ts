import type { AtpAgent } from '@atproto/api'
import { randomStr } from '@atproto/crypto'
import { type SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
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

  it('applies a global ip limit', async () => {
    const res = await agent.api.com.atproto.server.describeServer()
    expect(res.headers['ratelimit-limit']).toBe('3000')
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

describe('rate limits with ip limits disabled', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient
  let alice: DidString
  let bob: DidString

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'rate_limits_no_ip',
      pds: {
        redisScratchAddress: process.env.REDIS_HOST,
        redisScratchPassword: process.env.REDIS_PASSWORD,
        rateLimitsEnabled: true,
        disableIpRateLimits: true,
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

  it('does not apply a global ip limit', async () => {
    const res = await agent.api.com.atproto.server.describeServer()
    expect(res.headers['ratelimit-limit']).toBeUndefined()
  })

  it('does not rate limit by ip', async () => {
    for (let i = 0; i < 60; i++) {
      await expect(
        agent.api.com.atproto.server.resetPassword({
          token: randomStr(4, 'base32'),
          password: 'asdf1234',
        }),
      ).rejects.toThrow('Token is invalid')
    }
  })

  it('still rate limits repo writes per account', async () => {
    // 200 creates cost 600 points against the 5000 point hourly limit.
    const writeBatch = (did: DidString) =>
      agent.api.com.atproto.repo.applyWrites(
        {
          repo: did,
          writes: Array.from({ length: 200 }, (_, i) => ({
            $type: 'com.atproto.repo.applyWrites#create' as const,
            collection: 'app.bsky.feed.post',
            value: {
              $type: 'app.bsky.feed.post',
              text: `post ${i}`,
              createdAt: new Date().toISOString(),
            },
          })),
        },
        { encoding: 'application/json', headers: sc.getHeaders(did) },
      )
    for (let i = 0; i < 8; i++) {
      await writeBatch(alice)
    }
    await expect(writeBatch(alice)).rejects.toThrow('Rate Limit Exceeded')

    // does not rate limit another account
    await writeBatch(bob)
  })
})
