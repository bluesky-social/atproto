import AtpAgent from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import { forSnapshot } from '../_util'

describe('bsky actor likes feed views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_actor_lists',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('does not include reference lists in getActorLists', async () => {
    await pdsAgent.api.app.bsky.graph.list.create(
      {
        repo: sc.dids.alice,
      },
      {
        name: 'awesome starter pack list!',
        description: '',
        descriptionFacets: [],
        avatar: undefined,
        createdAt: new Date().toISOString(),
        purpose: 'app.bsky.graph.defs#referencelist',
      },
      sc.getHeaders(sc.dids.alice),
    )
    await pdsAgent.api.app.bsky.graph.list.create(
      {
        repo: sc.dids.alice,
      },
      {
        name: 'cool curate list!',
        description: '',
        descriptionFacets: [],
        avatar: undefined,
        createdAt: new Date().toISOString(),
        purpose: 'app.bsky.graph.defs#curatelist',
      },
      sc.getHeaders(sc.dids.alice),
    )
    await network.processAll()
    const view = await agent.api.app.bsky.graph.getLists({
      actor: sc.dids.alice,
    })
    expect(view.data.lists.length).toBe(1)
    expect(forSnapshot(view.data.lists)).toMatchSnapshot()
  })
})
