import AtpAgent from '@atproto/api'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import * as util from './_util'

describe('handles', () => {
  let agent: AtpAgent
  let close: util.CloseFn
  let sc: SeedClient

  let alice: string

  beforeAll(async () => {
    const server = await util.runTestServer({
      dbPostgresSchema: 'handles',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc, server.ctx.messageQueue)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await close()
  })

  it('allows a user to change their handle', async () => {
    await agent.api.com.atproto.handle.update(
      { handle: 'alice2.test' },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    const attemptOld = agent.api.com.atproto.handle.resolve({
      handle: 'alice.test',
    })
    await expect(attemptOld).rejects.toThrow('Unable to resolve handle')
    const attemptNew = await agent.api.com.atproto.handle.resolve({
      handle: 'alice2.test',
    })
    expect(attemptNew.data.did).toBe(alice)
  })
})
