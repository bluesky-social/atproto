import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { runTestServer, forSnapshot, CloseFn, paginateAll } from '../_util'
import { SeedClient } from '../seeds/client'
import usersBulkSeed from '../seeds/users-bulk'
import { App } from '../../src'
import * as locals from '../../src/locals'

describe('pds user search views', () => {
  let app: App
  let client: AtpServiceClient
  let close: CloseFn
  let sc: SeedClient
  let headers: { [s: string]: string }

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_user_search',
    })
    close = server.close
    app = server.app
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await usersBulkSeed(sc)
    headers = sc.getHeaders(Object.values(sc.dids)[0])
  })

  afterAll(async () => {
    await close()
  })

  it('typeahead gives relevant results', async () => {
    const result = await client.app.bsky.getUsersTypeahead(
      { term: 'car' },
      undefined,
      { headers },
    )

    const names = result.data.users.map((u) => u.name)

    const shouldContain = [
      'cara-wiegand69.test',
      'eudora-dietrich4.test', // Carol Littel
      'shane-torphy52.test', //Sadie Carter
      'aliya-hodkiewicz.test', // Carlton Abernathy IV
      'carlos6.test',
      'carolina-mcdermott77.test',
    ]

    shouldContain.forEach((name) => expect(names).toContain(name))

    if (locals.get(app).db.dialect === 'pg') {
      expect(names).toContain('cayla-marquardt39.test') // Fuzzy match supported by postgres
    } else {
      expect(names).not.toContain('cayla-marquardt39.test')
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

    shouldNotContain.forEach((name) => expect(names).not.toContain(name))

    if (locals.get(app).db.dialect === 'pg') {
      expect(forSnapshot(result.data.users)).toEqual(snapTypeaheadPg)
    } else {
      expect(forSnapshot(result.data.users)).toEqual(snapTypeaheadSqlite)
    }
  })

  it('typeahead gives empty result set when provided empty term', async () => {
    const result = await client.app.bsky.getUsersTypeahead(
      { term: '' },
      undefined,
      { headers },
    )

    expect(result.data.users).toEqual([])
  })

  it('typeahead applies limit', async () => {
    const full = await client.app.bsky.getUsersTypeahead(
      { term: 'p' },
      undefined,
      { headers },
    )

    expect(full.data.users.length).toBeGreaterThan(5)

    const limited = await client.app.bsky.getUsersTypeahead(
      { term: 'p', limit: 5 },
      undefined,
      { headers },
    )

    expect(limited.data.users).toEqual(full.data.users.slice(0, 5))
  })

  it('search gives relevant results', async () => {
    const result = await client.app.bsky.getUsersSearch(
      { term: 'car' },
      undefined,
      { headers },
    )

    const names = result.data.users.map((u) => u.name)

    const shouldContain = [
      'cara-wiegand69.test',
      'eudora-dietrich4.test', // Carol Littel
      'shane-torphy52.test', //Sadie Carter
      'aliya-hodkiewicz.test', // Carlton Abernathy IV
      'carlos6.test',
      'carolina-mcdermott77.test',
    ]

    shouldContain.forEach((name) => expect(names).toContain(name))

    if (locals.get(app).db.dialect === 'pg') {
      expect(names).toContain('cayla-marquardt39.test') // Fuzzy match supported by postgres
    } else {
      expect(names).not.toContain('cayla-marquardt39.test')
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

    shouldNotContain.forEach((name) => expect(names).not.toContain(name))

    if (locals.get(app).db.dialect === 'pg') {
      expect(forSnapshot(result.data.users)).toEqual(snapSearchPg)
    } else {
      expect(forSnapshot(result.data.users)).toEqual(snapSearchSqlite)
    }
  })

  it('search gives empty result set when provided empty term', async () => {
    const result = await client.app.bsky.getUsersSearch(
      { term: '' },
      undefined,
      { headers },
    )

    expect(result.data.users).toEqual([])
  })

  it('paginates', async () => {
    const results = (results) => results.flatMap((res) => res.users)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.getUsersSearch(
        { term: 'p', before: cursor, limit: 3 },
        undefined,
        { headers },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.users.length).toBeLessThanOrEqual(3),
    )

    const full = await client.app.bsky.getUsersSearch(
      { term: 'p' },
      undefined,
      { headers },
    )

    expect(full.data.users.length).toBeGreaterThan(5)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('search handles bad input', async () => {
    // Mostly for sqlite's benefit, since it uses LIKE and these are special characters that will
    // get stripped. This input triggers a special case where there are no "safe" words for sqlite to search on.
    const result = await client.app.bsky.getUsersSearch(
      { term: ' % _ ' },
      undefined,
      { headers },
    )

    expect(result.data.users).toEqual([])
  })
})

// Not using jest snapshots because it doesn't handle the conditional pg/sqlite very well:
// you can achieve it using named snapshots, but when you run the tests for pg the test suite fails
// since the sqlite snapshots appear obsolete to jest (and vice-versa when you run the sqlite suite).

const snapTypeaheadPg = [
  {
    did: 'user(0)',
    name: 'cara-wiegand69.test',
  },
  {
    did: 'user(1)',
    displayName: 'Carol Littel',
    name: 'eudora-dietrich4.test',
  },
  {
    did: 'user(2)',
    displayName: 'Sadie Carter',
    name: 'shane-torphy52.test',
  },
  {
    did: 'user(3)',
    displayName: 'Carlton Abernathy IV',
    name: 'aliya-hodkiewicz.test',
  },
  {
    did: 'user(4)',
    name: 'carlos6.test',
  },
  {
    did: 'user(5)',
    displayName: 'Latoya Windler',
    name: 'carolina-mcdermott77.test',
  },
  {
    did: 'user(6)',
    displayName: 'Rachel Kshlerin',
    name: 'cayla-marquardt39.test',
  },
]

const snapTypeaheadSqlite = [
  {
    did: 'user(0)',
    displayName: 'Carlton Abernathy IV',
    name: 'aliya-hodkiewicz.test',
  },
  {
    did: 'user(1)',
    name: 'cara-wiegand69.test',
  },
  {
    did: 'user(2)',
    name: 'carlos6.test',
  },
  {
    did: 'user(3)',
    displayName: 'Latoya Windler',
    name: 'carolina-mcdermott77.test',
  },
  {
    did: 'user(4)',
    displayName: 'Carol Littel',
    name: 'eudora-dietrich4.test',
  },
  {
    did: 'user(5)',
    displayName: 'Sadie Carter',
    name: 'shane-torphy52.test',
  },
]

const snapSearchPg = [
  {
    did: 'user(0)',
    name: 'cara-wiegand69.test',
  },
  {
    description: '',
    did: 'user(1)',
    displayName: 'Carol Littel',
    indexedAt: '1970-01-01T00:00:00.000Z',
    name: 'eudora-dietrich4.test',
  },
  {
    description: '',
    did: 'user(2)',
    displayName: 'Sadie Carter',
    indexedAt: '1970-01-01T00:00:00.000Z',
    name: 'shane-torphy52.test',
  },
  {
    description: '',
    did: 'user(3)',
    displayName: 'Carlton Abernathy IV',
    indexedAt: '1970-01-01T00:00:00.000Z',
    name: 'aliya-hodkiewicz.test',
  },
  {
    did: 'user(4)',
    name: 'carlos6.test',
  },
  {
    description: '',
    did: 'user(5)',
    displayName: 'Latoya Windler',
    indexedAt: '1970-01-01T00:00:00.000Z',
    name: 'carolina-mcdermott77.test',
  },
  {
    description: '',
    did: 'user(6)',
    displayName: 'Rachel Kshlerin',
    indexedAt: '1970-01-01T00:00:00.000Z',
    name: 'cayla-marquardt39.test',
  },
]

const snapSearchSqlite = [
  {
    description: '',
    did: 'user(0)',
    displayName: 'Carlton Abernathy IV',
    indexedAt: '1970-01-01T00:00:00.000Z',
    name: 'aliya-hodkiewicz.test',
  },
  {
    did: 'user(1)',
    name: 'cara-wiegand69.test',
  },
  {
    did: 'user(2)',
    name: 'carlos6.test',
  },
  {
    description: '',
    did: 'user(3)',
    displayName: 'Latoya Windler',
    indexedAt: '1970-01-01T00:00:00.000Z',
    name: 'carolina-mcdermott77.test',
  },
  {
    description: '',
    did: 'user(4)',
    displayName: 'Carol Littel',
    indexedAt: '1970-01-01T00:00:00.000Z',
    name: 'eudora-dietrich4.test',
  },
  {
    description: '',
    did: 'user(5)',
    displayName: 'Sadie Carter',
    indexedAt: '1970-01-01T00:00:00.000Z',
    name: 'shane-torphy52.test',
  },
]
