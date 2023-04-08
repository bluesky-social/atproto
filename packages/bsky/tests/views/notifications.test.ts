import AtpAgent from '@atproto/api'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
  paginateAll,
  TestServerInfo,
  processAll,
} from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { Notification } from '../../src/lexicon/types/app/bsky/notification/listNotifications'

describe('notification views', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'views_notifications',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    const pdsAgent = new AtpAgent({ service: server.pdsUrl })
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await processAll(server)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await close()
  })

  const sort = (notifs: Notification[]) => {
    // Need to sort because notification ordering is not well-defined
    return notifs.sort((a, b) => {
      if (a.author.handle === b.author.handle) {
        return a.indexedAt > b.indexedAt ? -1 : 1
      }
      return a.author.handle > b.author.handle ? -1 : 1
    })
  }

  it('fetches notification count without a last-seen', async () => {
    const notifCountAlice =
      await agent.api.app.bsky.notification.getUnreadCount(
        {},
        { headers: sc.getHeaders(alice, true) },
      )

    expect(notifCountAlice.data.count).toBe(11)

    const notifCountBob = await agent.api.app.bsky.notification.getUnreadCount(
      {},
      { headers: sc.getHeaders(sc.dids.bob, true) },
    )

    expect(notifCountBob.data.count).toBe(4)
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
    await processAll(server)

    const notifCountAlice =
      await agent.api.app.bsky.notification.getUnreadCount(
        {},
        { headers: sc.getHeaders(alice, true) },
      )

    expect(notifCountAlice.data.count).toBe(12)

    const notifCountBob = await agent.api.app.bsky.notification.getUnreadCount(
      {},
      { headers: sc.getHeaders(sc.dids.bob, true) },
    )

    expect(notifCountBob.data.count).toBe(5)
  })

  it('generates notifications for quotes', async () => {
    // Dan was quoted by alice
    const notifsDan = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: sc.getHeaders(sc.dids.dan, true) },
    )
    expect(forSnapshot(sort(notifsDan.data.notifications))).toMatchSnapshot()
  })

  it('fetches notifications without a last-seen', async () => {
    const notifRes = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: sc.getHeaders(alice, true) },
    )

    const notifs = notifRes.data.notifications
    expect(notifs.length).toBe(12)

    const readStates = notifs.map((notif) => notif.isRead)
    expect(readStates).toEqual(notifs.map(() => false))

    expect(forSnapshot(sort(notifs))).toMatchSnapshot()
  })

  it('paginates', async () => {
    const results = (results) =>
      sort(results.flatMap((res) => res.notifications))
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.notification.listNotifications(
        { cursor, limit: 6 },
        { headers: sc.getHeaders(alice, true) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.notifications.length).toBeLessThanOrEqual(6),
    )

    const full = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: sc.getHeaders(alice, true) },
    )

    expect(full.data.notifications.length).toEqual(12)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches notification count with a last-seen', async () => {
    const full = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: sc.getHeaders(alice, true) },
    )
    const notifCount = await agent.api.app.bsky.notification.getUnreadCount(
      { seenAt: full.data.notifications[3].indexedAt },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(notifCount.data.count).toBe(3)
  })

  it('fetches notifications with a last-seen', async () => {
    const full = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: sc.getHeaders(alice, true) },
    )
    const notifRes = await agent.api.app.bsky.notification.listNotifications(
      { seenAt: full.data.notifications[3].indexedAt },
      { headers: sc.getHeaders(alice, true) },
    )

    const notifs = notifRes.data.notifications
    expect(notifs.length).toBe(12)

    const readStates = notifs.map((notif) => notif.isRead)
    expect(readStates).toEqual(notifs.map((_, i) => i >= 3))

    expect(forSnapshot(sort(notifs))).toMatchSnapshot()
  })
})
