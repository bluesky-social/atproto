import AtpAgent from '@atproto/api'
import { TestEnvInfo, runTestEnv } from '@atproto/dev-env'
import { forSnapshot, paginateAll, processAll } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { Notification } from '../../src/lexicon/types/app/bsky/notification/listNotifications'

describe('notification views', () => {
  let testEnv: TestEnvInfo
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'views_notifications',
    })
    agent = new AtpAgent({ service: testEnv.bsky.url })
    const pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await processAll(testEnv)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await testEnv.close()
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
    await processAll(testEnv)

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

  it('does not give notifs for a deleted subject', async () => {
    const root = await sc.post(sc.dids.alice, 'root')
    const first = await sc.reply(sc.dids.bob, root.ref, root.ref, 'first')
    await sc.deletePost(sc.dids.alice, root.ref.uri)
    const second = await sc.reply(sc.dids.carol, root.ref, first.ref, 'second')
    await processAll(testEnv)

    const notifsAlice = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: sc.getHeaders(sc.dids.alice, true) },
    )
    const hasNotif = notifsAlice.data.notifications.some(
      (notif) => notif.uri === second.ref.uriStr,
    )
    expect(hasNotif).toBe(false)

    // cleanup
    await sc.deletePost(sc.dids.bob, first.ref.uri)
    await sc.deletePost(sc.dids.carol, second.ref.uri)
    await processAll(testEnv)
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
    const seenAt = full.data.notifications[3].indexedAt
    const notifCount = await agent.api.app.bsky.notification.getUnreadCount(
      { seenAt },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(notifCount.data.count).toBe(
      full.data.notifications.filter((n) => n.indexedAt > seenAt).length,
    )
    expect(notifCount.data.count).toBeGreaterThan(0)
  })

  it('fetches notifications with a last-seen', async () => {
    const full = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: sc.getHeaders(alice, true) },
    )
    const seenAt = full.data.notifications[3].indexedAt
    const notifRes = await agent.api.app.bsky.notification.listNotifications(
      { seenAt },
      { headers: sc.getHeaders(alice, true) },
    )

    const notifs = notifRes.data.notifications
    expect(notifs.length).toBe(12)

    const readStates = notifs.map((notif) => notif.isRead)
    expect(readStates).toEqual(notifs.map((n) => n.indexedAt <= seenAt))
  })
})
