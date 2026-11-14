import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { type AppBskyActorSearchActors, type AtpAgent, ids } from '@atproto/api'
// Imported from the package root so the store is the same instance the
// running service (loaded from dist by dev-env) uses.
import { realIpStore } from '@atproto/bsky'
import { wait } from '@atproto/common'
import {
  type SeedClient,
  TestNetwork,
  basicSeed,
  usersBulkSeed,
} from '@atproto/dev-env'
import { Gate } from '../../src/feature-gates/gates.js'
import { forSnapshot, paginateAll, stripViewer } from '../_util.js'

// @NOTE skipped to help with CI failures
// The search code is not used in production & we should switch it out for tests on the search proxy interface
describe.skip('pds actor search views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let headers: { [s: string]: string }
  let headersTypeahead: { [s: string]: string }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_actor_search',
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()

    await wait(50) // allow pending sub to be established
    await network.processAll()
    await network.bsky.sub.stop()
    await usersBulkSeed(sc)

    // Skip did/handle resolution for expediency
    const { db } = network.bsky
    const now = new Date().toISOString()
    await db.db
      .insertInto('actor')
      .values(
        Object.entries(sc.dids).map(([handle, did]) => ({
          did,
          handle,
          indexedAt: now,
        })),
      )
      .onConflict((oc) => oc.doNothing())
      .execute()

    // Process remaining profiles
    await network.bsky.sub.restart()
    headers = await network.serviceHeaders(
      Object.values(sc.dids)[0],
      ids.AppBskyActorSearchActors,
    )
    headersTypeahead = await network.serviceHeaders(
      Object.values(sc.dids)[0],
      ids.AppBskyActorSearchActorsTypeahead,
    )
  })

  beforeEach(async () => network.processAll(50_000), 50_100)
  afterAll(async () => network?.close())

  it('typeahead gives relevant results', async () => {
    const result = await agent.api.app.bsky.actor.searchActorsTypeahead(
      { term: 'car' },
      { headers: headersTypeahead },
    )

    const handles = result.data.actors.map((u) => u.handle)

    const shouldContain = [
      'cara-wiegand69.test',
      'eudora-dietrich4.test', // Carol Littel
      'shane-torphy52.test', // Sadie Carter
      'aliya-hodkiewicz.test', // Carlton Abernathy IV
      'carlos6.test',
      'carolina-mcderm77.test',
    ]

    shouldContain.forEach((handle) => expect(handles).toContain(handle))
    expect(handles).toContain('cayla-marquardt39.test') // Fuzzy match

    const shouldNotContain = [
      'sven70.test',
      'hilario84.test',
      'santa-hermann78.test',
      'dylan61.test',
      'preston-harris.test',
      'loyce95.test',
      'melyna-zboncak.test',
    ]

    shouldNotContain.forEach((handle) => expect(handles).not.toContain(handle))

    const sorted = result.data.actors.sort((a, b) =>
      a.handle > b.handle ? 1 : -1,
    )
    expect(forSnapshot(sorted)).toMatchSnapshot()
  })

  it('typeahead gives empty result set when provided empty term', async () => {
    const result = await agent.api.app.bsky.actor.searchActorsTypeahead(
      { term: '' },
      { headers: headersTypeahead },
    )

    expect(result.data.actors).toEqual([])
  })

  it('typeahead applies limit', async () => {
    const full = await agent.api.app.bsky.actor.searchActorsTypeahead(
      { term: 'p' },
      { headers: headersTypeahead },
    )

    expect(full.data.actors.length).toBeGreaterThan(5)

    const limited = await agent.api.app.bsky.actor.searchActorsTypeahead(
      { term: 'p', limit: 5 },
      { headers: headersTypeahead },
    )

    // @NOTE it's expected that searchActorsTypeahead doesn't have stable pagination

    const limitedIndexInFull = limited.data.actors.map((needle) => {
      return full.data.actors.findIndex(
        (haystack) => needle.did === haystack.did,
      )
    })

    // subset exists in full and is monotonic
    expect(limitedIndexInFull.every((idx) => idx !== -1)).toEqual(true)
    expect(limitedIndexInFull).toEqual(
      [...limitedIndexInFull].sort((a, b) => a - b),
    )
  })

  it('typeahead gives results unauthed', async () => {
    const { data: authed } =
      await agent.api.app.bsky.actor.searchActorsTypeahead(
        { term: 'car' },
        { headers: headersTypeahead },
      )
    const { data: unauthed } =
      await agent.api.app.bsky.actor.searchActorsTypeahead({
        term: 'car',
      })
    expect(unauthed.actors.length).toBeGreaterThan(0)
    expect(unauthed.actors).toEqual(authed.actors.map(stripViewer))
  })

  it('search gives relevant results', async () => {
    const result = await agent.api.app.bsky.actor.searchActors(
      { term: 'car' },
      { headers },
    )

    const handles = result.data.actors.map((u) => u.handle)

    const shouldContain = [
      'cara-wiegand69.test',
      'eudora-dietrich4.test', // Carol Littel
      'shane-torphy52.test', // Sadie Carter
      'aliya-hodkiewicz.test', // Carlton Abernathy IV
      'carlos6.test',
      'carolina-mcderm77.test',
    ]

    shouldContain.forEach((handle) => expect(handles).toContain(handle))
    expect(handles).toContain('cayla-marquardt39.test') // Fuzzy match

    const shouldNotContain = [
      'sven70.test',
      'hilario84.test',
      'santa-hermann78.test',
      'dylan61.test',
      'preston-harris.test',
      'loyce95.test',
      'melyna-zboncak.test',
    ]

    shouldNotContain.forEach((handle) => expect(handles).not.toContain(handle))

    const sorted = result.data.actors.sort((a, b) =>
      a.handle > b.handle ? 1 : -1,
    )
    expect(forSnapshot(sorted)).toMatchSnapshot()
  })

  it('search gives empty result set when provided empty term', async () => {
    const result = await agent.api.app.bsky.actor.searchActors(
      { term: '' },
      { headers },
    )

    expect(result.data.actors).toEqual([])
  })

  it('paginates', async () => {
    const results = (results: AppBskyActorSearchActors.OutputSchema[]) =>
      results.flatMap((res) => res.actors)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.actor.searchActors(
        { term: 'p', cursor, limit: 3 },
        { headers },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.actors.length).toBeLessThanOrEqual(3),
    )

    const full = await agent.api.app.bsky.actor.searchActors(
      { term: 'p' },
      { headers },
    )

    expect(full.data.actors.length).toBeGreaterThan(5)
    const sortedFull = results([full.data]).sort((a, b) =>
      a.handle > b.handle ? 1 : -1,
    )
    const sortedPaginated = results(paginatedAll).sort((a, b) =>
      a.handle > b.handle ? 1 : -1,
    )
    expect(sortedPaginated).toEqual(sortedFull)
  })

  it('search handles bad input', async () => {
    // Mostly for sqlite's benefit, since it uses LIKE and these are special characters that will
    // get stripped. This input triggers a special case where there are no "safe" words for sqlite to search on.
    const result = await agent.api.app.bsky.actor.searchActors(
      { term: ' % _ ' },
      { headers },
    )

    expect(result.data.actors).toEqual([])
  })

  it('search gives results unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.actor.searchActors(
      { term: 'car' },
      { headers },
    )
    const { data: unauthed } = await agent.api.app.bsky.actor.searchActors({
      term: 'car',
    })
    expect(unauthed.actors.length).toBeGreaterThan(0)
    expect(unauthed.actors).toEqual(authed.actors.map(stripViewer))
  })

  it('search blocks by actor takedown', async () => {
    await network.bsky.server.ctx.dataplane.takedownActor({
      did: sc.dids['cara-wiegand69.test'],
    })
    const result = await agent.api.app.bsky.actor.searchActorsTypeahead(
      { term: 'car' },
      { headers: headersTypeahead },
    )
    const handles = result.data.actors.map((u) => u.handle)
    expect(handles).toContain('carlos6.test')
    expect(handles).toContain('carolina-mcderm77.test')
    expect(handles).not.toContain('cara-wiegand69.test')
  })
})

describe('actor search pagination', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_actor_search_pagination',
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

  it('serves a page short of the limit after filtering actors, and returns a cursor only when more actors are available', async () => {
    const full = await network.bsky.ctx.dataplane.searchActors({
      term: '.test',
      limit: 100,
    })
    expect(full.dids.length).toBeGreaterThan(2)

    const exact = await network.bsky.ctx.dataplane.searchActors({
      term: '.test',
      limit: full.dids.length,
    })
    expect(exact.dids).toHaveLength(full.dids.length)
    expect(exact.cursor).toBe('')

    const over = await network.bsky.ctx.dataplane.searchActors({
      term: '.test',
      limit: full.dids.length - 1,
    })
    expect(over.dids).toHaveLength(full.dids.length - 1)
    expect(over.cursor).not.toBe('')

    const headers = await network.serviceHeaders(
      sc.dids.alice,
      ids.AppBskyActorSearchActors,
    )
    const terminal = await agent.app.bsky.actor.searchActors(
      { term: '.test', limit: full.dids.length },
      { headers },
    )
    expect(terminal.data.actors).toHaveLength(full.dids.length)
    expect(terminal.data.cursor).toBeUndefined()

    // Taking down the head actor leaves one of the two requested, which is
    // already half of the limit, so the page is served as is.
    await network.bsky.ctx.dataplane.takedownActor({ did: full.dids[0] })
    const short = await agent.app.bsky.actor.searchActors(
      { term: '.test', limit: 2 },
      { headers },
    )
    expect(short.data.actors).toHaveLength(1)
    expect(short.data.actors.map((actor) => actor.did)).not.toContain(
      full.dids[0],
    )
    expect(short.data.cursor).toBeDefined()
    await network.bsky.ctx.dataplane.untakedownActor({ did: full.dids[0] })
  })
})

describe('actor search real-ip forwarding', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // Toggled per test to exercise both the v2 (data-plane search) path and
  // the v1 fallback.
  let searchV2 = true

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_actor_search_real_ip',
    })
    vi.spyOn(network.bsky.ctx.featureGatesClient, 'scope').mockImplementation(
      () => ({
        Gate,
        checkGate: (gate) => (gate === Gate.SearchV2Enable ? searchV2 : false),
        checkGates: (gates) =>
          new Map(gates.map((gate) => [gate, gate === Gate.SearchV2Enable])),
      }),
    )
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => network?.close())

  // Wraps a data-plane client method so each call records the request-scoped
  // real-ip state observed at call time, while still calling through.
  const captureRealIpState = (
    method: 'searchActors' | 'searchActorsTypeahead' | 'getActors',
  ) => {
    const dataplane = network.bsky.ctx.dataplane
    // Loosely typed: the union of client methods has no single signature.
    const original: (...args: any[]) => Promise<any> = dataplane[method]
    const states: { ip?: string; authenticated?: boolean }[] = []
    const spy = vi
      .spyOn(dataplane, method)
      .mockImplementation((...args: any[]) => {
        states.push({ ...(realIpStore.getStore() ?? {}) })
        return original.apply(dataplane, args)
      })
    return { states, restored: () => spy.mockRestore() }
  }

  it('forwards a valid ipv4 address on the v2 data-plane call for unauthenticated requests', async () => {
    const { states, restored } = captureRealIpState('searchActorsTypeahead')
    try {
      await agent.api.app.bsky.actor.searchActorsTypeahead(
        { term: 'car' },
        { headers: { 'x-real-ip': '203.0.113.7' } },
      )
      expect(states).toEqual([{ ip: '203.0.113.7' }])
    } finally {
      restored()
    }
  })

  it('forwards a valid ipv6 address on the v2 data-plane call for unauthenticated requests', async () => {
    const { states, restored } = captureRealIpState('searchActorsTypeahead')
    try {
      await agent.api.app.bsky.actor.searchActorsTypeahead(
        { term: 'car' },
        { headers: { 'x-real-ip': '2001:db8::1' } },
      )
      expect(states).toEqual([{ ip: '2001:db8::1' }])
    } finally {
      restored()
    }
  })

  it('does not forward the address for authenticated requests', async () => {
    const { states, restored } = captureRealIpState('searchActorsTypeahead')
    try {
      const headers = await network.serviceHeaders(
        sc.dids.alice,
        ids.AppBskyActorSearchActorsTypeahead,
      )
      await agent.api.app.bsky.actor.searchActorsTypeahead(
        { term: 'car' },
        { headers: { ...headers, 'x-real-ip': '203.0.113.7' } },
      )
      expect(states).toEqual([{ ip: '203.0.113.7', authenticated: true }])
    } finally {
      restored()
    }
  })

  it('omits the address when the x-real-ip header is missing', async () => {
    const { states, restored } = captureRealIpState('searchActorsTypeahead')
    try {
      await agent.api.app.bsky.actor.searchActorsTypeahead({ term: 'car' })
      expect(states).toEqual([{ ip: undefined }])
    } finally {
      restored()
    }
  })

  it('omits malformed and ambiguous addresses without failing the request', async () => {
    for (const value of ['not-an-ip', '203.0.113.7, 203.0.113.8']) {
      const { states, restored } = captureRealIpState('searchActorsTypeahead')
      try {
        const result = await agent.api.app.bsky.actor.searchActorsTypeahead(
          { term: 'car' },
          { headers: { 'x-real-ip': value } },
        )
        expect(states, value).toEqual([{ ip: undefined }])
        expect(Array.isArray(result.data.actors), value).toBe(true)
      } finally {
        restored()
      }
    }
  })

  it('sends the same query, viewer, and limit with and without the address', async () => {
    const dataplane = network.bsky.ctx.dataplane
    const original = dataplane.searchActorsTypeahead
    const spy = vi
      .spyOn(dataplane, 'searchActorsTypeahead')
      .mockImplementation(async (...args: Parameters<typeof original>) =>
        original.apply(dataplane, args),
      )
    try {
      const headers = await network.serviceHeaders(
        sc.dids.alice,
        ids.AppBskyActorSearchActorsTypeahead,
      )
      await agent.api.app.bsky.actor.searchActorsTypeahead(
        { term: 'car' },
        { headers },
      )
      await agent.api.app.bsky.actor.searchActorsTypeahead(
        { term: 'car' },
        { headers: { ...headers, 'x-real-ip': '203.0.113.7' } },
      )
      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy.mock.calls[1][0]).toEqual(spy.mock.calls[0][0])
      expect(spy.mock.calls[0][0]).toMatchObject({
        params: { query: 'car', viewer: sc.dids.alice },
      })
    } finally {
      spy.mockRestore()
    }
  })

  it('forwards the address on the v1 fallback for unauthenticated requests', async () => {
    const { states, restored } = captureRealIpState('searchActors')
    searchV2 = false
    try {
      await agent.api.app.bsky.actor.searchActors(
        { term: 'car' },
        { headers: { 'x-real-ip': '203.0.113.7' } },
      )
      expect(states).toEqual([{ ip: '203.0.113.7' }])
    } finally {
      searchV2 = true
      restored()
    }
  })

  it('forwards the address on non-search endpoints for unauthenticated requests', async () => {
    const { states, restored } = captureRealIpState('getActors')
    try {
      await agent.api.app.bsky.actor.getProfiles(
        { actors: [sc.dids.bob] },
        { headers: { 'x-real-ip': '203.0.113.7' } },
      )
      // Hydration may make several data-plane calls; every one of them must
      // observe the request's address.
      expect(states.length).toBeGreaterThan(0)
      states.forEach((state) => expect(state).toEqual({ ip: '203.0.113.7' }))
    } finally {
      restored()
    }
  })
})
