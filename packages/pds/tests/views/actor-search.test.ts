import AtpAgent from '@atproto/api'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
  paginateAll,
  adminAuth,
} from '../_util'
import { SeedClient } from '../seeds/client'
import usersBulkSeed from '../seeds/users-bulk'
import { Database } from '../../src'

describe('pds user search views', () => {
  let agent: AtpAgent
  let db: Database
  let close: CloseFn
  let sc: SeedClient
  let headers: { [s: string]: string }

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_user_search',
    })
    close = server.close
    db = server.ctx.db
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await usersBulkSeed(sc)
    headers = sc.getHeaders(Object.values(sc.dids)[0])
    await server.ctx.backgroundQueue.processAll()
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

    if (db.dialect === 'pg') {
      expect(handles).toContain('cayla-marquardt39.test') // Fuzzy match supported by postgres
    } else {
      expect(handles).not.toContain('cayla-marquardt39.test')
    }

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

    if (db.dialect === 'pg') {
      expect(forSnapshot(result.data.actors)).toEqual(snapTypeaheadPg)
    } else {
      expect(forSnapshot(result.data.actors)).toEqual(snapTypeaheadSqlite)
    }
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

  it('search gives relevant results', async () => {
    const result = await agent.api.app.bsky.actor.searchActors(
      { term: 'car' },
      { headers },
    )

    const handles = result.data.actors.map((u) => u.handle)

    const shouldContain = [
      'cara-wiegand69.test',
      'eudora-dietrich4.test', // Carol Littel
      'shane-torphy52.test', //Sadie Carter
      'aliya-hodkiewicz.test', // Carlton Abernathy IV
      'carlos6.test',
      'carolina-mcdermott77.test',
    ]

    shouldContain.forEach((handle) => expect(handles).toContain(handle))

    if (db.dialect === 'pg') {
      expect(handles).toContain('cayla-marquardt39.test') // Fuzzy match supported by postgres
    } else {
      expect(handles).not.toContain('cayla-marquardt39.test')
    }

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

    if (db.dialect === 'pg') {
      expect(forSnapshot(result.data.actors)).toEqual(snapSearchPg)
    } else {
      expect(forSnapshot(result.data.actors)).toEqual(snapSearchSqlite)
    }
  })

  it('search gives empty result set when provided empty term', async () => {
    const result = await agent.api.app.bsky.actor.searchActors(
      { term: '' },
      { headers },
    )

    expect(result.data.actors).toEqual([])
  })

  it('paginates', async () => {
    const results = (results) => results.flatMap((res) => res.actors)
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

// Not using jest snapshots because it doesn't handle the conditional pg/sqlite very well:
// you can achieve it using named snapshots, but when you run the tests for pg the test suite fails
// since the sqlite snapshots appear obsolete to jest (and vice-versa when you run the sqlite suite).

const avatar =
  'https://pds.public.url/image/KzkHFsMRQ6oAKCHCRKFA1H-rDdc7VOtvEVpUJ82TwyQ/rs:fill:1000:1000:1:0/plain/bafkreiaivizp4xldojmmpuzmiu75cmea7nq56dnntnuhzhsjcb63aou5ei@jpeg'

const snapTypeaheadPg = [
  {
    did: 'user(0)',
    handle: 'cara-wiegand69.test',
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(1)',
    displayName: 'Carol Littel',
    handle: 'eudora-dietrich4.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(2)',
    displayName: 'Sadie Carter',
    handle: 'shane-torphy52.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(3)',
    displayName: 'Carlton Abernathy IV',
    handle: 'aliya-hodkiewicz.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(4)',
    handle: 'carlos6.test',
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(5)',
    displayName: 'Latoya Windler',
    handle: 'carolina-mcdermott77.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(6)',
    displayName: 'Rachel Kshlerin',
    handle: 'cayla-marquardt39.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
]

const snapTypeaheadSqlite = [
  {
    did: 'user(0)',
    displayName: 'Carlton Abernathy IV',
    handle: 'aliya-hodkiewicz.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(1)',
    handle: 'cara-wiegand69.test',
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(2)',
    handle: 'carlos6.test',
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(3)',
    displayName: 'Latoya Windler',
    handle: 'carolina-mcdermott77.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(4)',
    displayName: 'Carol Littel',
    handle: 'eudora-dietrich4.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(5)',
    displayName: 'Sadie Carter',
    handle: 'shane-torphy52.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
]

const snapSearchPg = [
  {
    did: 'user(0)',
    handle: 'cara-wiegand69.test',
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(1)',
    displayName: 'Carol Littel',
    indexedAt: '1970-01-01T00:00:00.000Z',
    handle: 'eudora-dietrich4.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(2)',
    displayName: 'Sadie Carter',
    indexedAt: '1970-01-01T00:00:00.000Z',
    handle: 'shane-torphy52.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(3)',
    displayName: 'Carlton Abernathy IV',
    indexedAt: '1970-01-01T00:00:00.000Z',
    handle: 'aliya-hodkiewicz.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(4)',
    handle: 'carlos6.test',
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(5)',
    displayName: 'Latoya Windler',
    indexedAt: '1970-01-01T00:00:00.000Z',
    handle: 'carolina-mcdermott77.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(6)',
    displayName: 'Rachel Kshlerin',
    indexedAt: '1970-01-01T00:00:00.000Z',
    handle: 'cayla-marquardt39.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
]

const snapSearchSqlite = [
  {
    did: 'user(0)',
    displayName: 'Carlton Abernathy IV',
    indexedAt: '1970-01-01T00:00:00.000Z',
    handle: 'aliya-hodkiewicz.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(1)',
    handle: 'cara-wiegand69.test',
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(2)',
    handle: 'carlos6.test',
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(3)',
    displayName: 'Latoya Windler',
    indexedAt: '1970-01-01T00:00:00.000Z',
    handle: 'carolina-mcdermott77.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(4)',
    displayName: 'Carol Littel',
    indexedAt: '1970-01-01T00:00:00.000Z',
    handle: 'eudora-dietrich4.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
  {
    did: 'user(5)',
    displayName: 'Sadie Carter',
    indexedAt: '1970-01-01T00:00:00.000Z',
    handle: 'shane-torphy52.test',
    avatar,
    viewer: { muted: false },
    labels: [],
  },
]
