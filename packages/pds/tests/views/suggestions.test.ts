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
    await server.ctx.backgroundQueue.processAll()
  })

  afterAll(async () => {
    await close()
  })

  it('actor suggestion gives users', async () => {
    const result = await agent.api.app.bsky.actor.getSuggestions(
      { limit: 3 },
      { headers: sc.getHeaders(sc.dids.carol) },
    )

    const handles = result.data.actors.map((u) => u.handle)
    const displayNames = result.data.actors.map((u) => u.displayName)

    const shouldContain: { handle: string; displayName: string | null }[] = [
      { handle: 'bob.test', displayName: 'bobby' },
      { handle: 'dan.test', displayName: null },
    ]

    shouldContain.forEach((actor) => {
      expect(handles).toContain(actor.handle)
      if (actor.displayName) {
        expect(displayNames).toContain(actor.displayName)
      }
    })
  })

  it('does not suggest followed users', async () => {
    const result = await agent.api.app.bsky.actor.getSuggestions(
      { limit: 3 },
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
    expect(result1.data.actors[0].displayName).toEqual('bobby')

    expect(result2.data.actors.length).toBe(1)
    expect(result2.data.actors[0].handle).toEqual('dan.test')
    expect(result2.data.actors[0].displayName).toBeUndefined()
  })
})
