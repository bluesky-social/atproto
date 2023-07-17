import AtpAgent from '@atproto/api'
import { runTestServer, CloseFn } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds user search views', () => {
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_suggestions',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    await server.processAll()

    const suggestions = [
      { did: sc.dids.bob, order: 1 },
      { did: sc.dids.carol, order: 2 },
      { did: sc.dids.dan, order: 3 },
    ]
    await server.ctx.db.db
      .insertInto('suggested_follow')
      .values(suggestions)
      .execute()
  })

  afterAll(async () => {
    await close()
  })

  it('actor suggestion gives users', async () => {
    const result = await agent.api.app.bsky.actor.getSuggestions(
      {},
      { headers: sc.getHeaders(sc.dids.carol) },
    )

    // does not include carol, because she is requesting
    expect(result.data.actors.length).toBe(2)
    expect(result.data.actors[0].handle).toEqual('bob.test')
    expect(result.data.actors[0].displayName).toEqual('bobby')
    expect(result.data.actors[1].handle).toEqual('dan.test')
    expect(result.data.actors[1].displayName).toBeUndefined()
  })

  it('does not suggest followed users', async () => {
    const result = await agent.api.app.bsky.actor.getSuggestions(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )

    // alice follows everyone
    expect(result.data.actors.length).toBe(0)
  })

  it('paginates', async () => {
    const result1 = await agent.api.app.bsky.actor.getSuggestions(
      { limit: 1 },
      { headers: sc.getHeaders(sc.dids.carol) },
    )
    const result2 = await agent.api.app.bsky.actor.getSuggestions(
      { limit: 1, cursor: result1.data.cursor },
      { headers: sc.getHeaders(sc.dids.carol) },
    )

    expect(result1.data.actors.length).toBe(1)
    expect(result1.data.actors[0].handle).toEqual('bob.test')
    expect(result2.data.actors.length).toBe(1)
    expect(result2.data.actors[0].handle).toEqual('dan.test')
  })
})
