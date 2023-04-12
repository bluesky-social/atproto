import AtpAgent from '@atproto/api'
import { CloseFn, runTestServer } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('sync listing', () => {
  let agent: AtpAgent
  let sc: SeedClient
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'sync_list',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
  })

  afterAll(async () => {
    await close()
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
