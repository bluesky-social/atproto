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

    await wait(50) // allow pending sub to be established
    await network.bsky.sub?.destroy()
    await usersBulkSeed(sc)

    // Skip did/handle resolution for expediency
    const { db } = network.bsky.ctx
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
    network.bsky.sub?.resume()
    await network.processAll(50000)
    headers = await network.adminHeaders({})
  })

  afterAll(async () => {
    await network.close()
  })

  it('gives relevant results when searched by handle', async () => {
    const result = await agent.api.com.atproto.admin.searchRepos(
      { term: 'car' },
      { headers },
    )

    const shouldContain = [
      'cara-wiegand69.test', // Present despite repo takedown
      'eudora-dietrich4.test', // Carol Littel
      'shane-torphy52.test', //Sadie Carter
      'aliya-hodkiewicz.test', // Carlton Abernathy IV
      'carlos6.test',
      'carolina-mcdermott77.test',
    ]

    const handles = result.data.repos.map((u) => u.handle)

    shouldContain.forEach((handle) => expect(handles).toContain(handle))
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
