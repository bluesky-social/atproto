import { runTestServer, TestServerInfo } from './_util'
import { SeedClient } from './seeds/client'
import userSeed from './seeds/basic'
import { AtpAgent } from '@atproto/api'
import { randomStr } from '@atproto/crypto'

describe('rate limits', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let sc: SeedClient
  let alice: string
  let bob: string

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'rate_limits',
      redisScratchAddress: process.env.REDIS_HOST,
      redisScratchPassword: process.env.REDIS_PASSWORD,
      rateLimitsEnabled: true,
    })
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await userSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  afterAll(async () => {
    await server.close()
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
    for (let i = 0; i < 10; i++) {
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
