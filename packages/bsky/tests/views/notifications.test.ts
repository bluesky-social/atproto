import AtpAgent from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import { forSnapshot, paginateAll } from '../_util'
import { Notification } from '../../src/lexicon/types/app/bsky/notification/listNotifications'

describe('notification views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_notifications',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
  })

  const sort = (notifs: Notification[]) => {
    // Need to sort because notification ordering is not well-defined
    return notifs.sort((a, b) => {
      const stableUriA = a.uri.replace(
        /\/did:plc:.+?\//,
        `/${a.author.handle}/`,
      )
      const stableUriB = b.uri.replace(
        /\/did:plc:.+?\//,
        `/${b.author.handle}/`,
      )
      if (stableUriA === stableUriB) {
        return a.indexedAt > b.indexedAt ? -1 : 1
      }
      return stableUriA > stableUriB ? -1 : 1
    })
  }

  it('fetches notification count without a last-seen', async () => {
    const notifCountAlice =
      await agent.api.app.bsky.notification.getUnreadCount(
        {},
        { headers: await network.serviceHeaders(alice) },
      )

    expect(notifCountAlice.data.count).toBe(12)

    const notifCountBob = await agent.api.app.bsky.notification.getUnreadCount(
      {},
      { headers: await network.serviceHeaders(sc.dids.bob) },
    )

    expect(notifCountBob.data.count).toBeGreaterThanOrEqual(3)
  })

  it('generates notifications for all reply ancestors', async () => {
    // Add to reply chain, post ancestors: alice -> bob -> alice -> carol.
    // Should have added one notification for each of alice and bob.
    await sc.reply(
      sc.dids.carol,
      sc.posts[alice][1].ref,
      sc.replies[alice][0].ref,
      'indeed',
    )
    await network.processAll()

    const notifCountAlice =
      await agent.api.app.bsky.notification.getUnreadCount(
        {},
        { headers: await network.serviceHeaders(alice) },
      )

    expect(notifCountAlice.data.count).toBe(13)

    const notifCountBob = await agent.api.app.bsky.notification.getUnreadCount(
      {},
      { headers: await network.serviceHeaders(sc.dids.bob) },
    )

    expect(notifCountBob.data.count).toBeGreaterThanOrEqual(4)
  })

  it('does not give notifs for a deleted subject', async () => {
    const root = await sc.post(sc.dids.alice, 'root')
    const first = await sc.reply(sc.dids.bob, root.ref, root.ref, 'first')
    await sc.deletePost(sc.dids.alice, root.ref.uri)
    const second = await sc.reply(sc.dids.carol, root.ref, first.ref, 'second')
    await network.processAll()

    const notifsAlice = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )
    const hasNotif = notifsAlice.data.notifications.some(
      (notif) => notif.uri === second.ref.uriStr,
    )
    expect(hasNotif).toBe(false)

    // cleanup
    await sc.deletePost(sc.dids.bob, first.ref.uri)
    await sc.deletePost(sc.dids.carol, second.ref.uri)
    await network.processAll()
  })

  it('generates notifications for quotes', async () => {
    // Dan was quoted by alice
    const notifsDan = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: await network.serviceHeaders(sc.dids.dan) },
    )
    expect(forSnapshot(sort(notifsDan.data.notifications))).toMatchSnapshot()
  })

  it('fetches notifications without a last-seen', async () => {
    const notifRes = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: await network.serviceHeaders(alice) },
    )

    const notifs = notifRes.data.notifications
    expect(notifs.length).toBe(13)

    const readStates = notifs.map((notif) => notif.isRead)
    expect(readStates).toEqual(notifs.map((_, i) => i !== 0)) // only first appears unread

    expect(forSnapshot(sort(notifs))).toMatchSnapshot()
  })

  it('paginates', async () => {
    const results = (results) =>
      sort(results.flatMap((res) => res.notifications))
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.notification.listNotifications(
        { cursor, limit: 6 },
        { headers: await network.serviceHeaders(alice) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.notifications.length).toBeLessThanOrEqual(6),
    )

    const full = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: await network.serviceHeaders(alice) },
    )

    expect(full.data.notifications.length).toEqual(13)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches notification count with a last-seen', async () => {
    const full = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: await network.serviceHeaders(alice) },
    )
    const seenAt = full.data.notifications[3].indexedAt
    await agent.api.app.bsky.notification.updateSeen(
      { seenAt },
      {
        headers: await network.serviceHeaders(alice),
        encoding: 'application/json',
      },
    )
    const full2 = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: await network.serviceHeaders(alice) },
    )
    expect(full2.data.notifications.length).toBe(full.data.notifications.length)
    expect(full2.data.seenAt).toEqual(seenAt)

    const notifCount = await agent.api.app.bsky.notification.getUnreadCount(
      {},
      { headers: await network.serviceHeaders(alice) },
    )

    expect(notifCount.data.count).toBe(
      full.data.notifications.filter((n) => n.indexedAt > seenAt).length,
    )
    expect(notifCount.data.count).toBeGreaterThan(0)

    // reset last-seen
    await agent.api.app.bsky.notification.updateSeen(
      { seenAt: new Date(0).toISOString() },
      {
        headers: await network.serviceHeaders(alice),
        encoding: 'application/json',
      },
    )
  })

  it('fetches notifications with a last-seen', async () => {
    const full = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: await network.serviceHeaders(alice) },
    )
    const seenAt = full.data.notifications[3].indexedAt
    await agent.api.app.bsky.notification.updateSeen(
      { seenAt },
      {
        headers: await network.serviceHeaders(alice),
        encoding: 'application/json',
      },
    )
    const notifRes = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: await network.serviceHeaders(alice) },
    )

    const notifs = notifRes.data.notifications
    expect(notifs.length).toBe(13)

    const readStates = notifs.map((notif) => notif.isRead)
    expect(readStates).toEqual(notifs.map((n) => n.indexedAt < seenAt))
    // reset last-seen
    await agent.api.app.bsky.notification.updateSeen(
      { seenAt: new Date(0).toISOString() },
      {
        headers: await network.serviceHeaders(alice),
        encoding: 'application/json',
      },
    )
  })

  it('fetches notifications omitting mentions and replies for taken-down posts', async () => {
    const postRef1 = sc.replies[sc.dids.carol][0].ref // Reply
    const postRef2 = sc.posts[sc.dids.dan][1].ref // Mention
    await Promise.all(
      [postRef1, postRef2].map((postRef) =>
        network.bsky.ctx.dataplane.takedownRecord({
          recordUri: postRef.uriStr,
        }),
      ),
    )

    const notifRes = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: await network.serviceHeaders(alice) },
    )
    const notifCount = await agent.api.app.bsky.notification.getUnreadCount(
      {},
      { headers: await network.serviceHeaders(alice) },
    )

    const notifs = sort(notifRes.data.notifications)
    expect(notifs.length).toBe(11)
    expect(forSnapshot(notifs)).toMatchSnapshot()
    expect(notifCount.data.count).toBe(11)

    // Cleanup
    await Promise.all(
      [postRef1, postRef2].map((postRef) =>
        network.bsky.ctx.dataplane.untakedownRecord({
          recordUri: postRef.uriStr,
        }),
      ),
    )
  })

  it('fetches notifications with explicit priority', async () => {
    const priority = await agent.api.app.bsky.notification.listNotifications(
      { priority: true },
      { headers: await network.serviceHeaders(sc.dids.carol) },
    )
    // only notifs from follow (alice)
    expect(
      priority.data.notifications.every(
        (notif) => ![sc.dids.bob, sc.dids.dan].includes(notif.author.did),
      ),
    ).toBe(true)
    expect(forSnapshot(priority.data)).toMatchSnapshot()
    const noPriority = await agent.api.app.bsky.notification.listNotifications(
      { priority: false },
      { headers: await network.serviceHeaders(sc.dids.carol) },
    )
    expect(forSnapshot(noPriority.data)).toMatchSnapshot()
  })

  it('fetches notifications with default priority', async () => {
    await agent.api.app.bsky.notification.putPreferences(
      { priority: true },
      {
        encoding: 'application/json',
        headers: await network.serviceHeaders(sc.dids.carol),
      },
    )
    await network.processAll()
    const notifs = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: await network.serviceHeaders(sc.dids.carol) },
    )
    // only notifs from follow (alice)
    expect(
      notifs.data.notifications.every(
        (notif) => ![sc.dids.bob, sc.dids.dan].includes(notif.author.did),
      ),
    ).toBe(true)
    expect(forSnapshot(notifs.data)).toMatchSnapshot()
  })

  it('fails open on clearly bad cursor.', async () => {
    const { data: notifs } =
      await agent.api.app.bsky.notification.listNotifications(
        { cursor: '90210::bafycid' },
        { headers: await network.serviceHeaders(alice) },
      )
    expect(notifs).toMatchObject({ notifications: [] })
  })
})
