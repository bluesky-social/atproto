import AtpAgent from '@atproto/api'
import { CloseFn, runTestEnv } from '@atproto/dev-env'
import { processAll, stripViewer } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds user search views', () => {
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  beforeAll(async () => {
    const testEnv = await runTestEnv({
      dbPostgresSchema: 'views_suggestions',
    })
    close = testEnv.close
    agent = new AtpAgent({ service: testEnv.bsky.url })
    const pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await processAll(testEnv)
  })

  afterAll(async () => {
    await close()
  })

  it('actor suggestion gives users', async () => {
    const result = await agent.api.app.bsky.actor.getSuggestions(
      { limit: 3 },
      { headers: sc.getHeaders(sc.dids.carol, true) },
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
      { headers: sc.getHeaders(sc.dids.alice, true) },
    )

    // alice follows everyone
    expect(result.data.actors.length).toBe(0)
  })

  it('paginates', async () => {
    const result1 = await agent.api.app.bsky.actor.getSuggestions(
      { limit: 1 },
      { headers: sc.getHeaders(sc.dids.carol, true) },
    )
    const result2 = await agent.api.app.bsky.actor.getSuggestions(
      { limit: 1, cursor: result1.data.cursor },
      { headers: sc.getHeaders(sc.dids.carol, true) },
    )

    expect(result1.data.actors.length).toBe(1)
    expect(result1.data.actors[0].handle).toEqual('bob.test')
    expect(result1.data.actors[0].displayName).toEqual('bobby')

    expect(result2.data.actors.length).toBe(1)
    expect(result2.data.actors[0].handle).toEqual('dan.test')
    expect(result2.data.actors[0].displayName).toBeUndefined()
  })

  it('fetches suggestions unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.actor.getSuggestions(
      {},
      { headers: sc.getHeaders(sc.dids.carol, true) },
    )
    const { data: unauthed } = await agent.api.app.bsky.actor.getSuggestions({})
    const omitViewerFollows = ({ did }) => {
      return did !== sc.dids.carol && !sc.follows[sc.dids.carol][did]
    }
    expect(unauthed.actors.length).toBeGreaterThan(0)
    expect(unauthed.actors.filter(omitViewerFollows)).toEqual(
      authed.actors.map(stripViewer),
    )
  })
})
