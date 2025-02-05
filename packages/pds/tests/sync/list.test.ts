import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import basicSeed from '../seeds/basic'

describe('sync listing', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'sync_list',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
  })

  afterAll(async () => {
    await network.close()
  })

  it('lists hosted repos in order of creation', async () => {
    const res = await agent.api.com.atproto.sync.listRepos()
    const dids = res.data.repos.map((repo) => repo.did)
    expect(dids).toEqual([
      sc.dids.alice,
      sc.dids.bob,
      sc.dids.carol,
      sc.dids.dan,
    ])
    expect(res.data.repos.every((r) => r.active === true)).toBe(true)
  })

  it('paginates listed hosted repos', async () => {
    const full = await agent.api.com.atproto.sync.listRepos()
    const pt1 = await agent.api.com.atproto.sync.listRepos({ limit: 2 })
    const pt2 = await agent.api.com.atproto.sync.listRepos({
      cursor: pt1.data.cursor,
    })
    expect([...pt1.data.repos, ...pt2.data.repos]).toEqual(full.data.repos)
  })
})
