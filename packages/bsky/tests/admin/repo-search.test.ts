import { SeedClient, TestNetwork } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { paginateAll } from '../_util'
import usersBulkSeed from '../seeds/users-bulk'

describe('admin repo search view', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let headers: { [s: string]: string }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'views_admin_repo_search',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await usersBulkSeed(sc)
    headers = network.pds.adminAuthHeaders()
  })

  afterAll(async () => {
    await network.close()
  })

  beforeAll(async () => {
    await sc.emitModerationEvent({
      event: { $type: 'com.atproto.admin.defs#modEventTakedown' },
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids['cara-wiegand69.test'],
      },
    })
  })

  it('gives relevant results', async () => {
    const result = await agent.api.com.atproto.admin.searchRepos(
      { term: 'car' },
      { headers },
    )

    const handles = result.data.repos.map((u) => u.handle)

    const shouldContain = [
      'cara-wiegand69.test', // Present despite repo takedown
      'carlos6.test',
      'carolina-mcdermott77.test',
    ]

    shouldContain.forEach((handle) => expect(handles).toContain(handle))

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
  })

  it('finds repo by did', async () => {
    const term = sc.dids['cara-wiegand69.test']
    const res = await agent.api.com.atproto.admin.searchRepos(
      { term },
      { headers },
    )

    expect(res.data.repos.length).toEqual(1)
    expect(res.data.repos[0].did).toEqual(term)
  })

  it('paginates with term', async () => {
    const results = (results) => results.flatMap((res) => res.users)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.com.atproto.admin.searchRepos(
        { term: 'p', cursor, limit: 3 },
        { headers },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.repos.length).toBeLessThanOrEqual(3),
    )

    const full = await agent.api.com.atproto.admin.searchRepos(
      { term: 'p' },
      { headers },
    )

    expect(full.data.repos.length).toBeGreaterThan(3)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('paginates without term', async () => {
    const results = (results) => results.flatMap((res) => res.repos)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.com.atproto.admin.searchRepos(
        { cursor, limit: 3 },
        { headers },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator, 5)
    paginatedAll.forEach((res) =>
      expect(res.repos.length).toBeLessThanOrEqual(3),
    )

    const full = await agent.api.com.atproto.admin.searchRepos(
      { limit: 15 },
      { headers },
    )

    expect(full.data.repos.length).toEqual(15)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
