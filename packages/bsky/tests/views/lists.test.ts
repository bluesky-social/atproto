import { AtpAgent } from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import { forSnapshot } from '../_util'
import { ids } from '../../src/lexicon/lexicons'

describe('bsky actor likes feed views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let curateList: string
  let referenceList: string
  let alice: string
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

    const newRefList = await sc.createList(
      sc.dids.eve,
      'blah starter pack list!',
      'reference',
    )
    const newCurrList = await sc.createList(
      sc.dids.eve,
      'blah curate list!',
      'curate',
    )

    await sc.addToList(sc.dids.eve, sc.dids.eve, newRefList)
    await sc.addToList(sc.dids.eve, sc.dids.bob, newRefList)
    await sc.addToList(sc.dids.eve, sc.dids.frankie, newRefList)

    await sc.addToList(sc.dids.eve, sc.dids.eve, newCurrList)
    await sc.addToList(sc.dids.eve, sc.dids.bob, newCurrList)
    await sc.addToList(sc.dids.eve, sc.dids.frankie, newCurrList)

    await sc.block(sc.dids.frankie, sc.dids.eve)

    await network.processAll()
    curateList = newCurrList.uriStr
    referenceList = newRefList.uriStr
    alice = sc.dids.alice
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
    expect(view.data.lists.length).toBe(2)
    expect(forSnapshot(view.data.lists)).toMatchSnapshot()
  })

  it('supports using a handle as getList actor param', async () => {
    const view = await agent.app.bsky.graph.getLists({
      actor: 'eve.test',
    })
    expect(view.data.lists.length).toBe(2)
    expect(forSnapshot(view.data.lists)).toMatchSnapshot()
  })

  it('does not include users with creator block relationship in reference lists for non-creator, in-list viewers', async () => {
    const curView = await agent.api.app.bsky.graph.getList(
      {
        list: curateList,
      },
      {
        headers: await network.serviceHeaders(frankie, ids.AppBskyGraphGetList),
      },
    )
    expect(curView.data.items.length).toBe(2)
    expect(forSnapshot(curView.data.items)).toMatchSnapshot()

    const refView = await agent.api.app.bsky.graph.getList(
      { list: referenceList },
      {
        headers: await network.serviceHeaders(frankie, ids.AppBskyGraphGetList),
      },
    )
    expect(refView.data.items.length).toBe(2)
    expect(forSnapshot(refView.data.items)).toMatchSnapshot()
  })

  it('does not include users with creator block relationship in reference lists for non-creator, not-in-list viewers', async () => {
    const curView = await agent.api.app.bsky.graph.getList(
      {
        list: curateList,
      },
      { headers: await network.serviceHeaders(greta, ids.AppBskyGraphGetList) },
    )
    expect(curView.data.items.length).toBe(2)
    expect(forSnapshot(curView.data.items)).toMatchSnapshot()

    const refView = await agent.api.app.bsky.graph.getList(
      { list: referenceList },
      { headers: await network.serviceHeaders(greta, ids.AppBskyGraphGetList) },
    )
    expect(refView.data.items.length).toBe(2)
    expect(forSnapshot(refView.data.items)).toMatchSnapshot()
  })

  it('does not include users with creator block relationship in reference and curate lists for signed-out viewers', async () => {
    const curView = await agent.api.app.bsky.graph.getList({
      list: curateList,
    })
    expect(curView.data.items.length).toBe(2)
    expect(forSnapshot(curView.data.items)).toMatchSnapshot()

    const refView = await agent.api.app.bsky.graph.getList({
      list: referenceList,
    })
    expect(refView.data.items.length).toBe(2)
    expect(forSnapshot(refView.data.items)).toMatchSnapshot()
  })

  it('does include users with creator block relationship in reference lists for creator', async () => {
    const curView = await agent.api.app.bsky.graph.getList(
      { list: curateList },
      { headers: await network.serviceHeaders(eve, ids.AppBskyGraphGetList) },
    )
    expect(curView.data.items.length).toBe(3)
    expect(forSnapshot(curView.data.items)).toMatchSnapshot()

    const refView = await agent.api.app.bsky.graph.getList(
      { list: referenceList },
      { headers: await network.serviceHeaders(eve, ids.AppBskyGraphGetList) },
    )
    expect(refView.data.items.length).toBe(3)
    expect(forSnapshot(refView.data.items)).toMatchSnapshot()
  })

  it('does return all users regardless of creator block relationship in moderation lists', async () => {
    const blockList = await sc.createList(eve, 'block list', 'mod')
    await sc.addToList(eve, frankie, blockList)
    await sc.addToList(eve, greta, blockList)
    await sc.block(frankie, greta)
    await network.processAll()

    const view = await agent.api.app.bsky.graph.getList(
      { list: blockList.uriStr },
      { headers: await network.serviceHeaders(alice, ids.AppBskyGraphGetList) },
    )
    expect(view.data.items.length).toBe(2)
    expect(forSnapshot(view.data.items)).toMatchSnapshot()
  })
})
