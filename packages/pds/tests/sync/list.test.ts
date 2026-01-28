import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import { com } from '../../src'
import basicSeed from '../seeds/basic'

describe('sync listing', () => {
  let network: TestNetworkNoAppView
  let client: Client
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'sync_list',
    })
    client = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
  })

  afterAll(async () => {
    await network.close()
  })

  it('lists hosted repos in order of creation', async () => {
    const res = await client.call(com.atproto.sync.listRepos)
    const dids = res.repos.map((repo) => repo.did)
    expect(dids).toEqual([
      sc.dids.alice,
      sc.dids.bob,
      sc.dids.carol,
      sc.dids.dan,
    ])
    expect(res.repos.every((r) => r.active === true)).toBe(true)
  })

  it('paginates listed hosted repos', async () => {
    const full = await client.call(com.atproto.sync.listRepos)
    const pt1 = await client.call(com.atproto.sync.listRepos, { limit: 2 })
    const pt2 = await client.call(com.atproto.sync.listRepos, {
      cursor: pt1.cursor,
    })
    expect([...pt1.repos, ...pt2.repos]).toEqual(full.repos)
  })
})
