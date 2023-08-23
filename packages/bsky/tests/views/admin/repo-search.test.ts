import AtpAgent from '@atproto/api'
import { wait } from '@atproto/common'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from '../../seeds/client'
import usersBulkSeed from '../../seeds/users-bulk'

describe('pds admin repo search views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let headers: { [s: string]: string }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_repo_search',
    })
    agent = network.bsky.getClient()
    const pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)

    await wait(100) // allow pending sub to be established
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
    headers = await network.adminHeaders({})
  })

  afterAll(async () => {
    await network.close()
  })

  it('gives relevant results when searched by handle', async () => {
    const term = 'car'
    const result = await agent.api.com.atproto.admin.searchRepos(
      { term },
      { headers },
    )

    const shouldContain = [
      // Present despite repo takedown
      // First item in the array because of direct handle match
      'cara-wiegand69.test',
      'carlos6.test',
      'aliya-hodkiewicz.test', // Carlton Abernathy IV
      'eudora-dietrich4.test', // Carol Littel
      'carolina-mcdermott77.test',
      'shane-torphy52.test', // Sadie Carter
      // Last item in the array because handle and display name none match very close to the the search term
      'cayla-marquardt39.test',
    ]

    const handles = result.data.repos.map((u) => u.handle)
    // Assert that all matches are found
    shouldContain.forEach((handle) => expect(handles).toContain(handle))
    // Assert that the order is correct, showing the closest match by handle first
    expect(handles[0].startsWith(term)).toBeTruthy()
    expect(handles[handles.length - 1].startsWith(term)).toBeFalsy()
  })

  it('gives relevant results when searched by did', async () => {
    const term = sc.dids['cara-wiegand69.test']
    const res = await agent.api.com.atproto.admin.searchRepos(
      { term },
      { headers },
    )

    expect(res.data.repos.length).toEqual(1)
    expect(res.data.repos[0].did).toEqual(term)
  })
})
