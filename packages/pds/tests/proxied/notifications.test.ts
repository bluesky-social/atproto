import AtpAgent from '@atproto/api'
import { runTestEnv, CloseFn, processAll, TestEnvInfo } from '@atproto/dev-env'
import { forSnapshot, paginateAll } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { Notification } from '../../src/lexicon/types/app/bsky/notification/listNotifications'

describe('pds notification proxy views', () => {
  let agent: AtpAgent
  let testEnv: TestEnvInfo
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'proxy_notifications',
    })
    close = testEnv.close
    agent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    await processAll(testEnv)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await close()
  })

  const sort = (notifs: Notification[]) => {
    return notifs.sort((a, b) => {
      if (a.indexedAt === b.indexedAt) {
        return a.uri > b.uri ? -1 : 1
      }
      return a.indexedAt > b.indexedAt ? -a : 1
    })
  }

  it('fetches notification count without a last-seen', async () => {
    const notifCountAlice =
      await agent.api.app.bsky.notification.getUnreadCount(
        {},
        { headers: sc.getHeaders(alice) },
      )

    expect(notifCountAlice.data.count).toBe(11)

    const notifCountBob = await agent.api.app.bsky.notification.getUnreadCount(
      {},
      { headers: sc.getHeaders(sc.dids.bob) },
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
        { headers: sc.getHeaders(alice) },
      )

    expect(notifCountAlice.data.count).toBe(12)

    const notifCountBob = await agent.api.app.bsky.notification.getUnreadCount(
      {},
      { headers: sc.getHeaders(sc.dids.bob) },
    )

    expect(notifCountBob.data.count).toBe(5)
  })

  it('generates notifications for quotes', async () => {
    // Dan was quoted by alice
    const notifsDan = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: sc.getHeaders(sc.dids.dan) },
    )
    expect(forSnapshot(notifsDan.data)).toMatchSnapshot()
  })

  it('fetches notifications without a last-seen', async () => {
    const notifRes = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: sc.getHeaders(alice) },
    )

    const notifs = sort(notifRes.data.notifications)
    expect(notifs.length).toBe(12)

    const readStates = notifs.map((notif) => notif.isRead)
    expect(readStates).toEqual(notifs.map(() => false))

    // @TODO while the exact order of these is not critically important,
    // it's odd to see carol's follow after bob's. In the seed they occur in
    // the opposite ordering.
    expect(forSnapshot(notifs)).toMatchSnapshot()
  })

  it('fetches notifications omitting records by a muted user', async () => {
    await agent.api.app.bsky.graph.muteActor(
      { actor: sc.dids.carol }, // Replier
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await agent.api.app.bsky.graph.muteActor(
      { actor: sc.dids.dan }, // Mentioner
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )

    const notifRes = await agent.api.app.bsky.notification.listNotifications(
      {},
      { headers: sc.getHeaders(alice) },
    )

    const notifs = sort(notifRes.data.notifications)
    expect(notifs.length).toBe(4)
    expect(forSnapshot(notifs)).toMatchSnapshot()

    // Cleanup
    await agent.api.app.bsky.graph.unmuteActor(
      { actor: sc.dids.carol },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await agent.api.app.bsky.graph.unmuteActor(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
  })

  it('paginates', async () => {
    const results = (results) =>
      sort(results.flatMap((res) => res.notifications))
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.notification.listNotifications(
        {
          cursor,
          limit: 6,
        },
        { headers: sc.getHeaders(alice) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.notifications.length).toBeLessThanOrEqual(6),
    )

    const full = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(full.data.notifications.length).toEqual(12)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('updates notifications last seen', async () => {
    const full = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: sc.getHeaders(alice),
      },
    )

    await agent.api.app.bsky.notification.updateSeen(
      { seenAt: full.data.notifications[3].indexedAt },
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )
  })

  it('fetches notification count with a last-seen', async () => {
    const notifCount = await agent.api.app.bsky.notification.getUnreadCount(
      {},
      { headers: sc.getHeaders(alice) },
    )

    expect(notifCount.data.count).toBe(3)
  })

  it('fetches notifications with a last-seen', async () => {
    const notifRes = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: sc.getHeaders(alice),
      },
    )

    const notifs = sort(notifRes.data.notifications)
    expect(notifs.length).toBe(12)

    const readStates = notifs.map((notif) => notif.isRead)
    expect(readStates).toEqual(notifs.map((_, i) => i >= 3))

    expect(forSnapshot(notifs)).toMatchSnapshot()
  })
})
