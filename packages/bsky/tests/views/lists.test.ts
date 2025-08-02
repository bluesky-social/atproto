import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { OutputSchema as GetListsOutputSchema } from '../../src/lexicon/types/app/bsky/graph/getLists'
import {
  ListWithMembership,
  OutputSchema as GetListsWithMembershipOutputSchema,
} from '../../src/lexicon/types/app/bsky/graph/getListsWithMembership'
import { forSnapshot, paginateAll } from '../_util'

describe('bsky actor likes feed views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let blockList: string
  let curateList: string
  let referenceList: string
  let eveListItemCur: string
  let frankieListItemCur: string
  let frankieListItemMod: string
  let gretaListItemMod: string

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

    const newRefList = await sc.createList(sc.dids.eve, 'ref0', 'reference')
    await sc.addToList(sc.dids.eve, sc.dids.eve, newRefList)
    await sc.addToList(sc.dids.eve, sc.dids.bob, newRefList)
    await sc.addToList(sc.dids.eve, sc.dids.frankie, newRefList)

    const newCurList = await sc.createList(sc.dids.eve, 'cur0', 'curate')
    await sc.createList(sc.dids.eve, 'cur1', 'curate')
    await sc.createList(sc.dids.eve, 'cur2', 'curate')
    const newEveListItemCur = await sc.addToList(
      sc.dids.eve,
      sc.dids.eve,
      newCurList,
    )
    await sc.addToList(sc.dids.eve, sc.dids.bob, newCurList)
    const newFrankieListItemCur = await sc.addToList(
      sc.dids.eve,
      sc.dids.frankie,
      newCurList,
    )

    const newBlockList = await sc.createList(sc.dids.eve, 'mod0', 'mod')
    await sc.createList(sc.dids.eve, 'mod1', 'mod')
    await sc.createList(sc.dids.eve, 'mod2', 'mod')
    const newFrankieListItemMod = await sc.addToList(
      sc.dids.eve,
      sc.dids.frankie,
      newBlockList,
    )
    const newGretaListItemMod = await sc.addToList(
      sc.dids.eve,
      sc.dids.greta,
      newBlockList,
    )

    await sc.block(sc.dids.frankie, sc.dids.greta)
    await sc.block(sc.dids.frankie, sc.dids.eve)

    await network.processAll()
    blockList = newBlockList.uriStr
    curateList = newCurList.uriStr
    referenceList = newRefList.uriStr

    eveListItemCur = newEveListItemCur.uriStr
    frankieListItemCur = newFrankieListItemCur.uriStr
    frankieListItemMod = newFrankieListItemMod.uriStr
    gretaListItemMod = newGretaListItemMod.uriStr

    alice = sc.dids.alice
    eve = sc.dids.eve
    frankie = sc.dids.frankie
    greta = sc.dids.greta
  })

  afterAll(async () => {
    await network.close()
  })

  it('does not include reference lists in getActorLists', async () => {
    const view = await agent.app.bsky.graph.getLists({
      actor: eve,
    })
    expect(view.data.lists.length).toBe(6)
    expect(forSnapshot(view.data.lists)).toMatchSnapshot()
  })

  it('supports using a handle as getList actor param', async () => {
    const view = await agent.app.bsky.graph.getLists({
      actor: 'eve.test',
    })
    expect(view.data.lists.length).toBe(6)
    expect(forSnapshot(view.data.lists)).toMatchSnapshot()
  })

  it('allows filtering by list purpose', async () => {
    const viewCurate = await agent.app.bsky.graph.getLists({
      actor: eve,
      purposes: ['curatelist'],
    })
    expect(viewCurate.data.lists.length).toBe(3)

    const viewMod = await agent.app.bsky.graph.getLists({
      actor: eve,
      purposes: ['modlist'],
    })
    expect(viewMod.data.lists.length).toBe(3)

    const viewAll = await agent.app.bsky.graph.getLists({
      actor: eve,
      purposes: ['curatelist', 'modlist'],
    })
    expect(viewAll.data.lists.length).toBe(6)
  })

  it.each([
    { expected: 6, purposes: [] },
    { expected: 6, purposes: ['curatelist', 'modlist'] },
    { expected: 3, purposes: ['curatelist'] },
    { expected: 3, purposes: ['modlist'] },
    { expected: 0, purposes: ['referencelist'] }, // not supported on getLists.
  ])(
    'paginates for purposes filter: $purposes',
    async ({ expected, purposes }) => {
      const results = (out: GetListsOutputSchema[]) =>
        out.flatMap((res) => res.lists)
      const paginator = async (cursor?: string) => {
        const res = await agent.app.bsky.graph.getLists(
          { actor: eve, purposes, limit: 2, cursor },
          {
            headers: await network.serviceHeaders(
              eve,
              ids.AppBskyGraphGetLists,
            ),
          },
        )
        return res.data
      }

      const paginatedAll = await paginateAll(paginator)
      paginatedAll.forEach((res) =>
        expect(res.lists.length).toBeLessThanOrEqual(2),
      )

      const full = await agent.app.bsky.graph.getLists(
        { actor: eve, purposes },
        {
          headers: await network.serviceHeaders(eve, ids.AppBskyGraphGetLists),
        },
      )
      expect(full.data.lists.length).toBe(expected)

      const sortedFull = results([full.data]).sort((a, b) =>
        a.uri > b.uri ? 1 : -1,
      )
      const sortedPaginated = results(paginatedAll).sort((a, b) =>
        a.uri > b.uri ? 1 : -1,
      )
      expect(sortedPaginated).toEqual(sortedFull)
    },
  )

  it('does not include users with creator block relationship in reference lists for non-creator, in-list viewers', async () => {
    const curView = await agent.app.bsky.graph.getList(
      {
        list: curateList,
      },
      {
        headers: await network.serviceHeaders(frankie, ids.AppBskyGraphGetList),
      },
    )
    expect(curView.data.items.length).toBe(2)
    expect(forSnapshot(curView.data.items)).toMatchSnapshot()

    const refView = await agent.app.bsky.graph.getList(
      { list: referenceList },
      {
        headers: await network.serviceHeaders(frankie, ids.AppBskyGraphGetList),
      },
    )
    expect(refView.data.items.length).toBe(2)
    expect(forSnapshot(refView.data.items)).toMatchSnapshot()
  })

  it('does not include users with creator block relationship in reference lists for non-creator, not-in-list viewers', async () => {
    const curView = await agent.app.bsky.graph.getList(
      {
        list: curateList,
      },
      { headers: await network.serviceHeaders(greta, ids.AppBskyGraphGetList) },
    )
    expect(curView.data.items.length).toBe(2)
    expect(forSnapshot(curView.data.items)).toMatchSnapshot()

    const refView = await agent.app.bsky.graph.getList(
      { list: referenceList },
      { headers: await network.serviceHeaders(greta, ids.AppBskyGraphGetList) },
    )
    expect(refView.data.items.length).toBe(2)
    expect(forSnapshot(refView.data.items)).toMatchSnapshot()
  })

  it('does not include users with creator block relationship in reference and curate lists for signed-out viewers', async () => {
    const curView = await agent.app.bsky.graph.getList({
      list: curateList,
    })
    expect(curView.data.items.length).toBe(2)
    expect(forSnapshot(curView.data.items)).toMatchSnapshot()

    const refView = await agent.app.bsky.graph.getList({
      list: referenceList,
    })
    expect(refView.data.items.length).toBe(2)
    expect(forSnapshot(refView.data.items)).toMatchSnapshot()
  })

  it('does include users with creator block relationship in reference lists for creator', async () => {
    const curView = await agent.app.bsky.graph.getList(
      { list: curateList },
      { headers: await network.serviceHeaders(eve, ids.AppBskyGraphGetList) },
    )
    expect(curView.data.items.length).toBe(3)
    expect(forSnapshot(curView.data.items)).toMatchSnapshot()

    const refView = await agent.app.bsky.graph.getList(
      { list: referenceList },
      { headers: await network.serviceHeaders(eve, ids.AppBskyGraphGetList) },
    )
    expect(refView.data.items.length).toBe(3)
    expect(forSnapshot(refView.data.items)).toMatchSnapshot()
  })

  it('does return all users regardless of creator block relationship in moderation lists', async () => {
    const view = await agent.app.bsky.graph.getList(
      { list: blockList },
      { headers: await network.serviceHeaders(alice, ids.AppBskyGraphGetList) },
    )
    expect(view.data.items.length).toBe(2)
    expect(forSnapshot(view.data.items)).toMatchSnapshot()
  })

  describe('list membership', () => {
    const uriSort = (a: string, b: string) => (a > b ? 1 : -1)
    const membershipsUris = (lwms: ListWithMembership[]): string[] =>
      lwms
        .map((lwm) => lwm.listItem?.uri)
        .filter((li): li is string => typeof li === 'string')
        .sort(uriSort)

    it('returns all lists by the user', async () => {
      const view = await agent.app.bsky.graph.getListsWithMembership(
        { actor: frankie },
        {
          headers: await network.serviceHeaders(
            eve,
            ids.AppBskyGraphGetListsWithMembership,
          ),
        },
      )
      expect(view.data.listsWithMembership.length).toBe(6)
    })

    it('finds self membership', async () => {
      const view = await agent.app.bsky.graph.getListsWithMembership(
        { actor: eve },
        {
          headers: await network.serviceHeaders(
            eve,
            ids.AppBskyGraphGetListsWithMembership,
          ),
        },
      )

      expect(view.data.listsWithMembership.length).toBe(6)
      const memberships = membershipsUris(view.data.listsWithMembership)
      const expectedMemberships = [eveListItemCur].sort(uriSort)
      expect(memberships).toEqual(expectedMemberships)
    })

    it('finds membership in curatelist and modlist if actor is in both and purpose filter includes both', async () => {
      const view = await agent.app.bsky.graph.getListsWithMembership(
        { actor: frankie },
        {
          headers: await network.serviceHeaders(
            eve,
            ids.AppBskyGraphGetListsWithMembership,
          ),
        },
      )

      expect(view.data.listsWithMembership.length).toBe(6)
      const memberships = membershipsUris(view.data.listsWithMembership)
      const expectedMemberships = [frankieListItemCur, frankieListItemMod].sort(
        uriSort,
      )
      expect(memberships).toEqual(expectedMemberships)
    })

    it('finds modlist membership filtering by modlist', async () => {
      const view = await agent.app.bsky.graph.getListsWithMembership(
        { actor: greta, purposes: ['modlist'] },
        {
          headers: await network.serviceHeaders(
            eve,
            ids.AppBskyGraphGetListsWithMembership,
          ),
        },
      )

      expect(view.data.listsWithMembership.length).toBe(3)
      const memberships = membershipsUris(view.data.listsWithMembership)
      const expectedMemberships = [gretaListItemMod].sort(uriSort)
      expect(memberships).toEqual(expectedMemberships)
    })

    it('does not find modlist membership filtering by curatelist', async () => {
      const view = await agent.app.bsky.graph.getListsWithMembership(
        { actor: greta, purposes: ['curatelist'] },
        {
          headers: await network.serviceHeaders(
            eve,
            ids.AppBskyGraphGetListsWithMembership,
          ),
        },
      )

      expect(view.data.listsWithMembership.length).toBe(3)
      const memberships = membershipsUris(view.data.listsWithMembership)
      expect(memberships.length).toBe(0)
    })

    it.each([
      { expected: 6, purposes: [] },
      { expected: 6, purposes: ['curatelist', 'modlist'] },
      { expected: 3, purposes: ['curatelist'] },
      { expected: 3, purposes: ['modlist'] },
      { expected: 0, purposes: ['referencelist'] }, // not supported on getLists.
    ])(
      'paginates for purposes filter: $purposes',
      async ({ expected, purposes }) => {
        const results = (out: GetListsWithMembershipOutputSchema[]) =>
          out.flatMap((res) => res.listsWithMembership)
        const paginator = async (cursor?: string) => {
          const res = await agent.app.bsky.graph.getListsWithMembership(
            { actor: eve, purposes, limit: 2, cursor },
            {
              headers: await network.serviceHeaders(
                eve,
                ids.AppBskyGraphGetListsWithMembership,
              ),
            },
          )
          return res.data
        }

        const paginatedAll = await paginateAll(paginator)
        paginatedAll.forEach((res) =>
          expect(res.listsWithMembership.length).toBeLessThanOrEqual(2),
        )

        const full = await agent.app.bsky.graph.getListsWithMembership(
          { actor: eve, purposes },
          {
            headers: await network.serviceHeaders(
              eve,
              ids.AppBskyGraphGetListsWithMembership,
            ),
          },
        )
        expect(full.data.listsWithMembership.length).toBe(expected)

        const sortedFull = results([full.data]).sort((a, b) =>
          a.list.uri > b.list.uri ? 1 : -1,
        )
        const sortedPaginated = results(paginatedAll).sort((a, b) =>
          a.list.uri > b.list.uri ? 1 : -1,
        )
        expect(sortedPaginated).toEqual(sortedFull)
      },
    )
  })
})
