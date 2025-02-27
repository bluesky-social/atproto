import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import basicSeed from '../seeds/basic'

describe('proxies appview procedures', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let alice: string
  let bob: string
  let carol: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_procedures',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc, { addModLabels: network.bsky })
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
  })

  afterAll(async () => {
    await network.close()
  })

  it('maintains muted actors.', async () => {
    // mute actors
    await agent.api.app.bsky.graph.muteActor(
      { actor: bob },
      {
        headers: sc.getHeaders(alice),
        encoding: 'application/json',
      },
    )
    await agent.api.app.bsky.graph.muteActor(
      { actor: carol },
      {
        headers: sc.getHeaders(alice),
        encoding: 'application/json',
      },
    )
    // check
    const { data: result1 } = await agent.api.app.bsky.graph.getMutes(
      {},
      { headers: sc.getHeaders(alice) },
    )
    expect(result1.mutes.map((x) => x.handle)).toEqual([
      'carol.test',
      'bob.test',
    ])
    // unmute actors
    await agent.api.app.bsky.graph.unmuteActor(
      { actor: bob },
      {
        headers: sc.getHeaders(alice),
        encoding: 'application/json',
      },
    )
    // check
    const { data: result2 } = await agent.api.app.bsky.graph.getMutes(
      {},
      { headers: sc.getHeaders(alice) },
    )
    expect(result2.mutes.map((x) => x.handle)).toEqual(['carol.test'])
  })

  it('maintains muted actor lists.', async () => {
    // setup lists
    const bobList = await agent.api.app.bsky.graph.list.create(
      { repo: bob },
      {
        name: 'bob mutes',
        purpose: 'app.bsky.graph.defs#modlist',
        description: "bob's list of mutes",
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(bob),
    )
    const carolList = await agent.api.app.bsky.graph.list.create(
      { repo: carol },
      {
        name: 'carol mutes',
        purpose: 'app.bsky.graph.defs#modlist',
        description: "carol's list of mutes",
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(carol),
    )
    await network.processAll()

    // mute lists
    await agent.api.app.bsky.graph.muteActorList(
      { list: bobList.uri },
      {
        headers: sc.getHeaders(alice),
        encoding: 'application/json',
      },
    )
    await agent.api.app.bsky.graph.muteActorList(
      { list: carolList.uri },
      {
        headers: sc.getHeaders(alice),
        encoding: 'application/json',
      },
    )
    await network.processAll()
    // check
    const { data: result1 } = await agent.api.app.bsky.graph.getListMutes(
      {},
      { headers: sc.getHeaders(alice) },
    )
    expect(result1.lists.map((x) => x.uri)).toEqual([
      carolList.uri,
      bobList.uri,
    ])
    // unmute lists
    await agent.api.app.bsky.graph.unmuteActorList(
      { list: bobList.uri },
      {
        headers: sc.getHeaders(alice),
        encoding: 'application/json',
      },
    )
    // check
    const { data: result2 } = await agent.api.app.bsky.graph.getListMutes(
      {},
      { headers: sc.getHeaders(alice) },
    )
    expect(result2.lists.map((x) => x.uri)).toEqual([carolList.uri])
  })

  it('maintains notification last seen state.', async () => {
    // check original notifs
    const { data: result1 } =
      await agent.api.app.bsky.notification.listNotifications(
        {},
        { headers: sc.getHeaders(alice) },
      )
    expect(result1.notifications.length).toBeGreaterThanOrEqual(5)
    expect(
      result1.notifications.every((n, i) => {
        return (i === 0 && !n.isRead) || (i !== 0 && n.isRead)
      }),
    ).toBe(true)
    // update last seen
    const { indexedAt: lastSeenAt } = result1.notifications[2]
    await agent.api.app.bsky.notification.updateSeen(
      { seenAt: lastSeenAt },
      {
        headers: sc.getHeaders(alice),
        encoding: 'application/json',
      },
    )
    // check
    const { data: result2 } =
      await agent.api.app.bsky.notification.listNotifications(
        {},
        { headers: sc.getHeaders(alice) },
      )
    expect(result2.notifications.some((n) => n.isRead)).toBe(true)
    expect(result2.notifications.some((n) => !n.isRead)).toBe(true)
    expect(result2.notifications).toEqual(
      result1.notifications.map((n) => ({
        ...n,
        isRead: n.indexedAt < lastSeenAt,
      })),
    )
  })
})
