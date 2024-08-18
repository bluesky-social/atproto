import { AtpAgent } from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import { forSnapshot } from '../_util'
import { ids } from '../../src/lexicon/lexicons'

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
    await basicSeed(sc)
    await sc.createAccount('eve', {
      handle: 'eve.test',
      email: 'eve@eve.com',
      password: 'hunter2',
    })
    await sc.createAccount('frankie', {
      handle: 'frankie.test',
      email: 'frankie@frankie.com',
      password: '2hunter2real',
    })
    await sc.createAccount('greta', {
      handle: 'greta.test',
      email: 'greta@greta.com',
      password: 'hunter4real',
    })
    const newList = await sc.createList(
      sc.dids.eve,
      'blah starter pack list!',
      'reference',
    )
    await sc.addToList(sc.dids.eve, sc.dids.eve, newList)
    await sc.addToList(sc.dids.eve, sc.dids.bob, newList)
    await sc.addToList(sc.dids.eve, sc.dids.frankie, newList)
    await sc.block(sc.dids.frankie, sc.dids.eve)
    await network.processAll()
    referenceList = newList.uriStr
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
      { list: referenceList },
      {
        headers: await network.serviceHeaders(frankie, ids.AppBskyGraphGetList),
      },
    )
    expect(view.data.items.length).toBe(2)
    expect(forSnapshot(view.data.items)).toMatchSnapshot()
  })

  it('does not include users with creator block relationship in reference lists for non-creator, not-in-list viewers', async () => {
    const view = await agent.api.app.bsky.graph.getList(
      { list: referenceList },
      { headers: await network.serviceHeaders(greta, ids.AppBskyGraphGetList) },
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
      { list: referenceList },
      { headers: await network.serviceHeaders(eve, ids.AppBskyGraphGetList) },
    )
    expect(view.data.items.length).toBe(3)
    expect(forSnapshot(view.data.items)).toMatchSnapshot()
  })
})
