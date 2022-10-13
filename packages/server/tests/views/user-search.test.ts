import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import { runTestServer, CloseFn } from '../_util'
import { SeedClient } from '../seeds/client'
import usersBulkSeed from '../seeds/users-bulk'
import { App } from '../../src'
import * as locals from '../../src/locals'

describe('pds user search views', () => {
  let app: App // @TODO ensure other tests know App now always exists
  let client: AdxServiceClient
  let close: CloseFn
  let sc: SeedClient
  let headers: { [s: string]: string }

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_user_search',
    })
    close = server.close
    app = server.app
    client = AdxApi.service(server.url)
    sc = new SeedClient(client)
    await usersBulkSeed(sc)
    headers = sc.getHeaders(Object.values(sc.dids)[0])
  })

  afterAll(async () => {
    await close()
  })

  it('typeahad gives relevant results', async () => {
    const result = await client.app.bsky.getUsersTypeahead(
      { term: 'car' },
      undefined,
      { headers },
    )

    const names = result.data.users.map((u) => u.name)

    const shouldContain = [
      'Cara.Wiegand69',
      'Eudora_Dietrich4', // Carol Littel
      'Shane_Torphy52', // Sadie Carter
      'Aliya.Hodkiewicz', // Carlton Abernathy IV
      'Carlos6',
      'Carolina_McDermott77',
    ]

    shouldContain.forEach((name) => expect(names).toContain(name))

    if (locals.get(app).db.dialect === 'pg') {
      expect(names).toContain('Cayla_Marquardt39') // Fuzzy match supported by postgres
    } else {
      expect(names).not.toContain('Cayla_Marquardt39')
    }

    const shouldNotContain = [
      'Sven70',
      'Hilario84',
      'Santa_Hermann78',
      'Dylan61',
      'Preston_Harris',
      'Loyce95',
      'Melyna_Zboncak',
    ]

    shouldNotContain.forEach((name) => expect(names).not.toContain(name))
  })

  it('typeahead gives empty result set when given empty term', async () => {
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
})
