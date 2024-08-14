import { AtpAgent } from '@atproto/api'
import { TestNetwork, SeedClient, listsSeed } from '@atproto/dev-env'
import { forSnapshot } from '../_util'

describe('bsky actor likes feed views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let referenceList: string
  let eve: string
  let frankie: string
  let greta: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_actor_lists',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await listsSeed(sc)
    await network.processAll()
    referenceList = Object.values(sc.lists[sc.dids.eve])[0].ref.uriStr
    eve = sc.dids.eve
    frankie = sc.dids.frankie
    greta = sc.dids.greta
  })

  afterAll(async () => {
    await network.close()
  })

  it('does not include reference lists in getActorLists', async () => {
    await sc.createList(eve, 'cool curate list', 'curate')
    await network.processAll()
    const view = await agent.api.app.bsky.graph.getLists({
      actor: eve,
    })
    expect(view.data.lists.length).toBe(1)
    expect(forSnapshot(view.data.lists)).toMatchSnapshot()
  })

  it('does not include users with creator block relationship in reference lists for non-creator, in-list viewers', async () => {
    const view = await agent.api.app.bsky.graph.getList(
      {
        list: referenceList,
      },
      { headers: await network.serviceHeaders(frankie) },
    )
    expect(view.data.items.length).toBe(2)
    expect(forSnapshot(view.data.items)).toMatchSnapshot()
  })

  it('does not include users with creator block relationship in reference lists for non-creator, not-in-list viewers', async () => {
    const view = await agent.api.app.bsky.graph.getList(
      {
        list: referenceList,
      },
      { headers: await network.serviceHeaders(greta) },
    )
    expect(view.data.items.length).toBe(2)
    expect(forSnapshot(view.data.items)).toMatchSnapshot()
  })

  it('does not include users with creator block relationship in reference lists for signed-out viewers', async () => {
    const view = await agent.api.app.bsky.graph.getList({
      list: referenceList,
    })
    expect(view.data.items.length).toBe(2)
    expect(forSnapshot(view.data.items)).toMatchSnapshot()
  })

  it('does include users with creator block relationship in reference lists for creator', async () => {
    const view = await agent.api.app.bsky.graph.getList(
      {
        list: referenceList,
      },
      { headers: await network.serviceHeaders(eve) },
    )
    expect(view.data.items.length).toBe(3)
    expect(forSnapshot(view.data.items)).toMatchSnapshot()
  })
})
