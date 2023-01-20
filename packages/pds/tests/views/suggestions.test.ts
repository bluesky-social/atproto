import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { runTestServer, CloseFn } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds user search views', () => {
  let client: AtpServiceClient
  let close: CloseFn
  let sc: SeedClient

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_suggestions',
    })
    close = server.close
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc)
  })

  afterAll(async () => {
    await close()
  })

  it('actor suggestion gives users', async () => {
    const result = await client.app.bsky.actor.getSuggestions(
      { limit: 3 },
      { headers: sc.getHeaders(sc.dids.alice) },
    )

    const handles = result.data.actors.map((u) => u.handle)
    const displayNames = result.data.actors.map((u) => u.displayName)

    const shouldContain: { handle: string; displayName: string | null }[] = [
      { handle: 'alice.test', displayName: 'ali' },
      { handle: 'bob.test', displayName: 'bobby' },
    ]

    const third = sc.dids.carol > sc.dids.dan ? sc.dids.carol : sc.dids.dan
    shouldContain.push({
      handle: sc.accounts[third].handle,
      displayName: sc.profiles[third]?.displayName || null,
    })

    shouldContain.forEach((actor) => {
      expect(handles).toContain(actor.handle)
      if (actor.displayName) {
        expect(displayNames).toContain(actor.displayName)
      }
    })
  })

  it('includes follow state', async () => {
    const result = await client.app.bsky.actor.getSuggestions(
      { limit: 2 },
      { headers: sc.getHeaders(sc.dids.carol) },
    )
    // carol follows alice (first) but not bob (second)
    expect(result.data.actors[0].myState?.follow).toBeDefined()
    expect(result.data.actors[1].myState?.follow).toBeUndefined()
  })

  it('paginates', async () => {
    const result1 = await client.app.bsky.actor.getSuggestions(
      { limit: 2 },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    const result2 = await client.app.bsky.actor.getSuggestions(
      { limit: 2, cursor: result1.data.cursor },
      { headers: sc.getHeaders(sc.dids.alice) },
    )

    const handles = result2.data.actors.map((u) => u.handle)
    const displayNames = result2.data.actors.map((u) => u.displayName)

    const shouldContain = [
      { handle: 'carol.test', displayName: null },
      { handle: 'dan.test', displayName: null },
    ]

    shouldContain.forEach((actor) => {
      expect(handles).toContain(actor.handle)
      if (actor.displayName) {
        expect(displayNames).toContain(actor.displayName)
      }
    })
  })
})
