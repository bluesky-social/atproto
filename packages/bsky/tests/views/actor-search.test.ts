import AtpAgent from '@atproto/api'
import { wait } from '@atproto/common'
import { CloseFn, runTestEnv } from '@atproto/dev-env'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'
import {
  adminAuth,
  forSnapshot,
  paginateAll,
  processAll,
  stripViewer,
} from '../_util'
import { SeedClient } from '../seeds/client'
import usersBulkSeed from '../seeds/users-bulk'

describe('pds actor search views', () => {
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient
  let headers: { [s: string]: string }

  beforeAll(async () => {
    const testEnv = await runTestEnv({
      dbPostgresSchema: 'views_actor_search',
    })
    close = testEnv.close
    agent = new AtpAgent({ service: testEnv.bsky.url })
    const pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)

    await wait(50) // allow pending sub to be established
    await testEnv.bsky.sub.destroy()
    await usersBulkSeed(sc)

    // Skip did/handle resolution for expediency
    const { db } = testEnv.bsky.ctx
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
    testEnv.bsky.sub.resume()
    await processAll(testEnv, 20000)
    headers = sc.getHeaders(Object.values(sc.dids)[0], true)
  })

  afterAll(async () => {
    await close()
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

    expect(handles).toContain('cayla-marquardt39.test') // Fuzzy match supported by postgres

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

    expect(forSnapshot(result.data.actors)).toMatchSnapshot()
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

    expect(limited.data.actors).toEqual(full.data.actors.slice(0, 5))
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

    expect(handles).toContain('cayla-marquardt39.test') // Fuzzy match supported by postgres

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

    expect(forSnapshot(result.data.actors)).toMatchSnapshot()
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
    expect(results(paginatedAll)).toEqual(results([full.data]))
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
    await agent.api.com.atproto.admin.takeModerationAction(
      {
        action: TAKEDOWN,
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids['cara-wiegand69.test'],
        },
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
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
