import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { forSnapshot, paginateAll } from '../_util'
import { SeedClient } from '../seeds/client'
import usersBulkSeed from '../seeds/users-bulk'

describe('mute views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let silas: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_mutes',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await usersBulkSeed(sc, 10)
    silas = sc.dids['silas77.test']
    const mutes = [
      'aliya-hodkiewicz.test',
      'adrienne49.test',
      'jeffrey-sawayn87.test',
      'nicolas-krajcik10.test',
      'magnus53.test',
      'elta48.test',
    ]
    await network.processAll()
    for (const did of mutes) {
      await agent.api.app.bsky.graph.muteActor(
        { actor: did },
        {
          headers: await network.serviceHeaders(silas),
          encoding: 'application/json',
        },
      )
    }
  })

  afterAll(async () => {
    await network.close()
  })

  it('fetches mutes for the logged-in user.', async () => {
    const { data: view } = await agent.api.app.bsky.graph.getMutes(
      {},
      { headers: await network.serviceHeaders(silas) },
    )
    expect(forSnapshot(view.mutes)).toMatchSnapshot()
  })

  it('paginates.', async () => {
    const results = (results) => results.flatMap((res) => res.mutes)
    const paginator = async (cursor?: string) => {
      const { data: view } = await agent.api.app.bsky.graph.getMutes(
        { cursor, limit: 2 },
        { headers: await network.serviceHeaders(silas) },
      )
      return view
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.mutes.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.graph.getMutes(
      {},
      { headers: await network.serviceHeaders(silas) },
    )

    expect(full.data.mutes.length).toEqual(6)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('removes mute.', async () => {
    const { data: initial } = await agent.api.app.bsky.graph.getMutes(
      {},
      { headers: await network.serviceHeaders(silas) },
    )
    expect(initial.mutes.length).toEqual(6)
    expect(initial.mutes.map((m) => m.handle)).toContain('elta48.test')

    await agent.api.app.bsky.graph.unmuteActor(
      { actor: sc.dids['elta48.test'] },
      {
        headers: await network.serviceHeaders(silas),
        encoding: 'application/json',
      },
    )

    const { data: final } = await agent.api.app.bsky.graph.getMutes(
      {},
      { headers: await network.serviceHeaders(silas) },
    )
    expect(final.mutes.length).toEqual(5)
    expect(final.mutes.map((m) => m.handle)).not.toContain('elta48.test')

    await agent.api.app.bsky.graph.muteActor(
      { actor: sc.dids['elta48.test'] },
      {
        headers: await network.serviceHeaders(silas),
        encoding: 'application/json',
      },
    )
  })

  it('does not allow muting self.', async () => {
    const promise = agent.api.app.bsky.graph.muteActor(
      { actor: silas },
      {
        headers: await network.serviceHeaders(silas),
        encoding: 'application/json',
      },
    )
    await expect(promise).rejects.toThrow('Cannot mute oneself')
  })
})
