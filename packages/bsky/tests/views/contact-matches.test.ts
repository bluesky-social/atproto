import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { type AtpAgent, ids } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { GetMatchesResponse } from '../../src/proto/rolodex_pb.js'

describe('contact matches', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_contact_matches',
      bsky: { rolodexUrl: 'http://localhost:1' },
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await sc.createAccount('eve', {
      handle: 'eve.test',
      email: 'eve@test.com',
      password: 'eve-pass',
    })
    await sc.createProfile(sc.dids.eve, 'Eve', 'Eve profile')
    await sc.block(sc.dids.alice, sc.dids.bob)
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

  it('fills the page after filtering blocked matches and returns a cursor only when more matches are available', async () => {
    const subjects = [sc.dids.bob, sc.dids.carol, sc.dids.dan, sc.dids.eve]
    const getMatches = vi
      .spyOn(network.bsky.server.ctx.rolodexClient!, 'getMatches')
      .mockImplementation(async ({ cursor, limit }) => {
        const offset = cursor ? Number(cursor) : 0
        const items = subjects.slice(offset, offset + (limit ?? 50))
        const next = offset + items.length
        return new GetMatchesResponse({
          subjects: items,
          cursor: next < subjects.length ? String(next) : '',
        })
      })
    const headers = await network.serviceHeaders(
      sc.dids.alice,
      ids.AppBskyContactGetMatches,
    )

    const exact = await agent.app.bsky.contact.getMatches(
      { limit: 3 },
      { headers },
    )
    expect(exact.data.matches.map((match) => match.did)).toEqual([
      sc.dids.carol,
      sc.dids.dan,
      sc.dids.eve,
    ])
    expect(exact.data.cursor).toBeUndefined()
    expect(getMatches).toHaveBeenCalledTimes(2)

    getMatches.mockClear()
    const over = await agent.app.bsky.contact.getMatches(
      { limit: 2 },
      { headers },
    )
    expect(over.data.matches.map((match) => match.did)).toEqual([
      sc.dids.carol,
      sc.dids.dan,
    ])
    expect(over.data.cursor).toBe('3')
    expect(getMatches).toHaveBeenCalledTimes(2)
  })
})
