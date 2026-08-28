import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { type AtpAgent, ids } from '@atproto/api'
import {
  type RecordRef,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { AtUri } from '@atproto/syntax'

describe('reference-list opt-outs', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let referenceList: RecordRef
  let curateList: RecordRef
  let moderationList: RecordRef
  let malformedList: RecordRef
  let missingListUri: string
  let optOutUri: string
  const starterPackUris: string[] = []

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_reference_list_opt_outs',
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)

    referenceList = await sc.createList(
      sc.dids.alice,
      'reference list',
      'reference',
    )
    curateList = await sc.createList(sc.dids.alice, 'curate list', 'curate')
    moderationList = await sc.createList(
      sc.dids.alice,
      'moderation list',
      'mod',
    )
    malformedList = await sc.createList(
      sc.dids.alice,
      'malformed list',
      'reference',
      { purpose: 'invalid-list-purpose' },
    )
    for (const list of [referenceList, curateList]) {
      await sc.addToList(sc.dids.alice, sc.dids.bob, list)
      await sc.addToList(sc.dids.alice, sc.dids.carol, list)
    }
    for (const list of [moderationList, malformedList]) {
      await sc.addToList(sc.dids.alice, sc.dids.bob, list)
    }

    const optOut = await sc.agent.app.bsky.graph.referencelistoptout.create(
      { repo: sc.dids.bob },
      {
        subject: referenceList.uriStr,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.bob),
    )
    optOutUri = optOut.uri
    missingListUri = `at://${sc.dids.alice}/${ids.AppBskyGraphList}/missing`
    for (const subject of [
      curateList.uriStr,
      moderationList.uriStr,
      malformedList.uriStr,
      missingListUri,
    ]) {
      await sc.agent.app.bsky.graph.referencelistoptout.create(
        { repo: sc.dids.bob },
        { subject, createdAt: new Date().toISOString() },
        sc.getHeaders(sc.dids.bob),
      )
    }

    for (const name of ['shared list pack one', 'shared list pack two']) {
      const pack = await sc.agent.app.bsky.graph.starterpack.create(
        { repo: sc.dids.alice },
        {
          name,
          list: referenceList.uriStr,
          createdAt: new Date().toISOString(),
        },
        sc.getHeaders(sc.dids.alice),
      )
      starterPackUris.push(pack.uri)
    }

    await sc.post(sc.dids.bob, 'opted-out member post')
    await sc.post(sc.dids.carol, 'visible member post')
    await network.processAll()
  })

  afterAll(async () => network?.close())

  it('filters members for public viewers and annotates them for the owner', async () => {
    const owner = await agent.app.bsky.graph.getList(
      { list: referenceList.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyGraphGetList,
        ),
      },
    )
    const nonOwner = await agent.app.bsky.graph.getList(
      { list: referenceList.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.carol,
          ids.AppBskyGraphGetList,
        ),
      },
    )
    const anonymous = await agent.app.bsky.graph.getList({
      list: referenceList.uriStr,
    })

    expect(owner.data.list.listItemCount).toBe(2)
    expect(owner.data.items).toHaveLength(2)
    expect(
      owner.data.items.find((item) => item.subject.did === sc.dids.bob),
    ).toMatchObject({ subjectOptedOut: true })
    for (const view of [nonOwner, anonymous]) {
      expect(view.data.list.listItemCount).toBe(2)
      expect(view.data.items.map((item) => item.subject.did)).toEqual([
        sc.dids.carol,
      ])
      expect(view.data.items[0].subjectOptedOut).toBeUndefined()
    }

    const limited = await agent.app.bsky.graph.getList({
      list: referenceList.uriStr,
      limit: 1,
    })
    expect(limited.data.items).toHaveLength(1)
    expect(limited.data.cursor).toBeUndefined()
  })

  it('hydrates the indexed opt-out URI as viewer state', async () => {
    const { data } = await agent.app.bsky.graph.getList(
      { list: referenceList.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyGraphGetList,
        ),
      },
    )

    expect(data.list.viewer?.referenceListOptOut).toBe(optOutUri)
  })

  it('filters reference-list feeds for every viewer without viewer context', async () => {
    const requests = [
      agent.app.bsky.feed.getListFeed({ list: referenceList.uriStr }),
      agent.app.bsky.feed.getListFeed(
        { list: referenceList.uriStr },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyFeedGetListFeed,
          ),
        },
      ),
      agent.app.bsky.feed.getListFeed(
        { list: referenceList.uriStr },
        {
          headers: await network.serviceHeaders(
            sc.dids.carol,
            ids.AppBskyFeedGetListFeed,
          ),
        },
      ),
    ]

    for (const response of await Promise.all(requests)) {
      expect(
        response.data.feed.some((item) => item.post.author.did === sc.dids.bob),
      ).toBe(false)
      expect(
        response.data.feed.some(
          (item) => item.post.author.did === sc.dids.carol,
        ),
      ).toBe(true)
    }
  })

  it('shares owner annotations across starter packs backed by one list', async () => {
    using getListMembers = vi.spyOn(
      network.bsky.ctx.dataplane,
      'getListMembers',
    )
    const { data } = await agent.app.bsky.graph.getStarterPacksWithMembership(
      { actor: sc.dids.bob },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyGraphGetStarterPacksWithMembership,
        ),
      },
    )

    const sharedPacks = data.starterPacksWithMembership.filter(
      ({ starterPack }) => starterPackUris.includes(starterPack.uri),
    )
    expect(sharedPacks).toHaveLength(2)
    for (const { starterPack } of sharedPacks) {
      expect(starterPack.list?.listItemCount).toBe(2)
      expect(
        starterPack.listItemsSample?.find(
          (item) => item.subject.did === sc.dids.bob,
        ),
      ).toMatchObject({ subjectOptedOut: true })
    }
    expect(
      getListMembers.mock.calls.filter(
        ([req]) => req.listUri === referenceList.uriStr,
      ),
    ).toHaveLength(1)
  })

  it('filters opted-out subjects from non-owner starter-pack samples', async () => {
    const { data } = await agent.app.bsky.graph.getStarterPack(
      { starterPack: starterPackUris[0] },
      {
        headers: await network.serviceHeaders(
          sc.dids.carol,
          ids.AppBskyGraphGetStarterPack,
        ),
      },
    )

    expect(data.starterPack.list?.listItemCount).toBe(2)
    expect(
      data.starterPack.listItemsSample?.map((item) => item.subject.did),
    ).toEqual([sc.dids.carol])
  })

  it('does not apply opt-outs to non-reference lists', async () => {
    const { data: listData } = await agent.app.bsky.graph.getList(
      { list: curateList.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyGraphGetList,
        ),
      },
    )
    const { data: feedData } = await agent.app.bsky.feed.getListFeed({
      list: curateList.uriStr,
    })

    expect(listData.items.map((item) => item.subject.did)).toContain(
      sc.dids.bob,
    )
    expect(listData.list.viewer?.referenceListOptOut).toBeUndefined()
    expect(
      feedData.feed.some((item) => item.post.author.did === sc.dids.bob),
    ).toBe(true)
  })

  it('does not expose state for moderation, malformed, or missing lists', async () => {
    for (const list of [moderationList, malformedList]) {
      const { data } = await agent.app.bsky.graph.getList(
        { list: list.uriStr },
        {
          headers: await network.serviceHeaders(
            sc.dids.bob,
            ids.AppBskyGraphGetList,
          ),
        },
      )
      expect(data.items.map((item) => item.subject.did)).toContain(sc.dids.bob)
      expect(data.items[0].subjectOptedOut).toBeUndefined()
      expect(data.list.viewer?.referenceListOptOut).toBeUndefined()
    }

    const internal =
      await network.bsky.ctx.dataplane.getReferencelistoptoutsByActorAndSubjects(
        { actorDid: sc.dids.bob, subjectUris: [missingListUri] },
      )
    expect(internal.uris).toEqual([''])
  })

  it('restores visibility after deleting the indexed opt-out', async () => {
    const uri = new AtUri(optOutUri)
    await sc.agent.app.bsky.graph.referencelistoptout.delete(
      { repo: sc.dids.bob, rkey: uri.rkey },
      sc.getHeaders(sc.dids.bob),
    )
    await network.processAll()

    const { data } = await agent.app.bsky.graph.getList(
      { list: referenceList.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyGraphGetList,
        ),
      },
    )
    expect(data.items.map((item) => item.subject.did)).toContain(sc.dids.bob)
    expect(data.list.viewer?.referenceListOptOut).toBeUndefined()
  })
})
