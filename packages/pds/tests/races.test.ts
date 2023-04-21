import AtpAgent from '@atproto/api'
import { CloseFn, runTestServer } from './_util'
import AppContext from '../src/context'

describe('crud operations', () => {
  let ctx: AppContext
  let agent: AtpAgent
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'races',
    })
    ctx = server.ctx
    close = server.close
    agent = new AtpAgent({ service: server.url })
    await agent.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
  })

  afterAll(async () => {
    await close()
  })

  it('handles races in record routes', async () => {
    let promises: Promise<unknown>[] = []
    for (let i = 0; i < 10; i++) {
      promises.push(
        agent.api.app.bsky.feed.post.create(
          { repo: agent.session?.did },
          { text: 'blah', createdAt: new Date().toISOString() },
        ),
      )
    }
    await Promise.all(promises)
  })
})
