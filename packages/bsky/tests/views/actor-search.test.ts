import AtpAgent from '@atproto/api'
import { wait } from '@atproto/common'
import { TestNetwork, SeedClient } from '@atproto/dev-env'
import { forSnapshot, paginateAll, stripViewer } from '../_util'
import usersBulkSeed from '../seeds/users-bulk'

// @NOTE skipped to help with CI failures
// The search code is not used in production & we should switch it out for tests on the search proxy interface
describe.skip('pds actor search views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let headers: { [s: string]: string }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_actor_search',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()

    await wait(50) // allow pending sub to be established
    await network.bsky.ingester.sub.destroy()
    await usersBulkSeed(sc)

    // Skip did/handle resolution for expediency
    const db = network.bsky.ctx.db.getPrimary()
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
    network.bsky.ingester.sub.resume()
    await network.processAll(50000)
    await network.bsky.processAll()
    headers = await network.serviceHeaders(Object.values(sc.dids)[0])
  })

  afterAll(async () => {
    await network.close()
  })

  it('typeahead gives relevant results', async () => {
    const result = await agent.api.app.bsky.actor.searchActorsTypeahead(
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
      'carolina-mcdermott77.test',
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
      { headers },
    )

    expect(result.data.actors).toEqual([])
  })

  it('typeahead applies limit', async () => {
    const full = await agent.api.app.bsky.actor.searchActorsTypeahead(
      { term: 'p' },
      { headers },
    )

    expect(full.data.actors.length).toBeGreaterThan(5)

    const limited = await agent.api.app.bsky.actor.searchActorsTypeahead(
      { term: 'p', limit: 5 },
      { headers },
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
        { headers },
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
      'carolina-mcdermott77.test',
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
    const results = (results) => results.flatMap((res) => res.users)
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
    await agent.api.com.atproto.admin.emitModerationEvent(
      {
        event: { $type: 'com.atproto.admin.defs#modEventTakedown' },
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids['cara-wiegand69.test'],
        },
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
    const result = await agent.api.app.bsky.actor.searchActorsTypeahead(
      { term: 'car' },
      { headers },
    )
    const handles = result.data.actors.map((u) => u.handle)
    expect(handles).toContain('carlos6.test')
    expect(handles).toContain('carolina-mcdermott77.test')
    expect(handles).not.toContain('cara-wiegand69.test')
  })
})
