import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import { DidString } from '@atproto/syntax'
import { app } from '../../src'
import basicSeed from '../seeds/basic'

describe('proxies appview procedures', () => {
  let network: TestNetwork
  let client: Client
  let sc: SeedClient

  let alice: DidString
  let bob: DidString
  let carol: DidString

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_procedures',
    })
    client = network.pds.getClient()
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
    await client.call(
      app.bsky.graph.muteActor,
      { actor: bob },
      { headers: sc.getHeaders(alice) },
    )
    await client.call(
      app.bsky.graph.muteActor,
      { actor: carol },
      { headers: sc.getHeaders(alice) },
    )
    // check
    const result1 = await client.call(
      app.bsky.graph.getMutes,
      {},
      { headers: sc.getHeaders(alice) },
    )
    expect(result1.mutes.map((x) => x.handle)).toEqual([
      'carol.test',
      'bob.test',
    ])
    // unmute actors
    await client.call(
      app.bsky.graph.unmuteActor,
      { actor: bob },
      { headers: sc.getHeaders(alice) },
    )
    // check
    const result2 = await client.call(
      app.bsky.graph.getMutes,
      {},
      { headers: sc.getHeaders(alice) },
    )
    expect(result2.mutes.map((x) => x.handle)).toEqual(['carol.test'])
  })

  it('maintains muted actor lists.', async () => {
    // setup lists
    const bobList = await client.create(
      app.bsky.graph.list,
      {
        name: 'bob mutes',
        purpose: 'app.bsky.graph.defs#modlist',
        description: "bob's list of mutes",
        createdAt: new Date().toISOString(),
      },
      { repo: bob, headers: sc.getHeaders(bob) },
    )
    const carolList = await client.create(
      app.bsky.graph.list,
      {
        name: 'carol mutes',
        purpose: 'app.bsky.graph.defs#modlist',
        description: "carol's list of mutes",
        createdAt: new Date().toISOString(),
      },
      { repo: carol, headers: sc.getHeaders(carol) },
    )
    await network.processAll()

    // mute lists
    await client.call(
      app.bsky.graph.muteActorList,
      { list: bobList.uri },
      { headers: sc.getHeaders(alice) },
    )
    await client.call(
      app.bsky.graph.muteActorList,
      { list: carolList.uri },
      { headers: sc.getHeaders(alice) },
    )
    await network.processAll()
    // check
    const result1 = await client.call(
      app.bsky.graph.getListMutes,
      {},
      { headers: sc.getHeaders(alice) },
    )
    expect(result1.lists.map((x) => x.uri)).toEqual([
      carolList.uri,
      bobList.uri,
    ])
    // unmute lists
    await client.call(
      app.bsky.graph.unmuteActorList,
      { list: bobList.uri },
      { headers: sc.getHeaders(alice) },
    )
    // check
    const result2 = await client.call(
      app.bsky.graph.getListMutes,
      {},
      { headers: sc.getHeaders(alice) },
    )
    expect(result2.lists.map((x) => x.uri)).toEqual([carolList.uri])
  })

  it('maintains notification last seen state.', async () => {
    // check original notifs
    const result1 = await client.call(
      app.bsky.notification.listNotifications,
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
    await client.call(
      app.bsky.notification.updateSeen,
      { seenAt: lastSeenAt },
      { headers: sc.getHeaders(alice) },
    )
    // check
    const result2 = await client.call(
      app.bsky.notification.listNotifications,
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
