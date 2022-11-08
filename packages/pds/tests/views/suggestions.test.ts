import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { runTestServer, forSnapshot, CloseFn, paginateAll } from '../_util'
import { SeedClient } from '../seeds/client'
import usersBulkSeed from '../seeds/users-bulk'
import { App } from '../../src'

describe('pds user search views', () => {
  let app: App
  let client: AtpServiceClient
  let close: CloseFn
  let sc: SeedClient
  let headers: { [s: string]: string }

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_suggestions',
    })
    close = server.close
    app = server.app
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    const users = [
      { handle: 'silas77.test', displayName: 'Tanya Denesik' },
      { handle: 'nicolas-krajcik10.test', displayName: null },
      { handle: 'lennie-strosin.test', displayName: null },
      { handle: 'aliya-hodkiewicz.test', displayName: 'Carlton Abernathy IV' },
      { handle: 'jeffrey-sawayn87.test', displayName: 'Patrick Sawayn' },
      { handle: 'kaycee66.test', displayName: null },
    ]
    for (const { handle, displayName } of users) {
      await sc.createAccount(handle, {
        handle: handle,
        password: 'password',
        email: `${handle}@bsky.app`,
      })
      if (displayName !== null) {
        await sc.createProfile(sc.dids[handle], displayName, '')
      }
    }
    headers = sc.getHeaders(Object.values(sc.dids)[0])
  })

  afterAll(async () => {
    await close()
  })

  it('actor suggestion gives users', async () => {
    const result = await client.app.bsky.actor.getSuggestions(
      { limit: 3 },
      { headers },
    )

    const handles = result.data.actors.map((u) => u.handle)
    const displayNames = result.data.actors.map((u) => u.displayName)

    const shouldContain = [
      { handle: 'silas77.test', displayName: 'Tanya Denesik' },
      { handle: 'nicolas-krajcik10.test', displayName: null },
      { handle: 'lennie-strosin.test', displayName: null },
    ]

    shouldContain.forEach((actor) => {
      expect(handles).toContain(actor.handle)
      if (actor.displayName) {
        expect(displayNames).toContain(actor.displayName)
      }
    })
  })

  it('includes follow state', async () => {
    const result = await client.app.bsky.actor.getSuggestions(
      { limit: 3 },
      { headers },
    )
  })

  it('paginates', async () => {
    const result1 = await client.app.bsky.actor.getSuggestions(
      { limit: 3 },
      { headers },
    )
    const result2 = await client.app.bsky.actor.getSuggestions(
      { limit: 3, cursor: result1.data.cursor },
      { headers },
    )

    const handles = result2.data.actors.map((u) => u.handle)
    const displayNames = result2.data.actors.map((u) => u.displayName)

    const shouldContain = [
      { handle: 'aliya-hodkiewicz.test', displayName: 'Carlton Abernathy IV' },
      { handle: 'jeffrey-sawayn87.test', displayName: 'Patrick Sawayn' },
      { handle: 'kaycee66.test', displayName: null },
    ]

    shouldContain.forEach((actor) => {
      expect(handles).toContain(actor.handle)
      if (actor.displayName) {
        expect(displayNames).toContain(actor.displayName)
      }
    })
  })
})
