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

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'rate_limits',
      redisHost: process.env.REDIS_HOST,
      redisPassword: process.env.REDIS_PASSWORD,
      rateLimitsEnabled: true,
    })
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await userSeed(sc)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await server.close()
  })

  it('rate limits', async () => {
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
})
