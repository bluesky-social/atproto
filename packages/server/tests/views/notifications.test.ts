import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import { runTestServer, forSnapshot, CloseFn, paginateAll } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import * as locals from '../../src/locals'
import { App } from '../../src'

describe('pds notification views', () => {
  let client: AdxServiceClient
  let close: CloseFn
  let app: App
  let sc: SeedClient

  // account dids, for convenience
  let alice: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_noitifications',
    })
    close = server.close
    app = server.app
    client = AdxApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await close()
  })

  it('fetches notification count without a last-seen', async () => {
    const notifCount = await client.app.bsky.getNotificationCount(
      {},
      undefined,
      { headers: sc.getHeaders(alice) },
    )

    expect(notifCount.data.count).toBe(14)
  })

  it('fetches notifications without a last-seen', async () => {
    const notifRes = await client.app.bsky.getNotifications({}, undefined, {
      headers: sc.getHeaders(alice),
    })

    const notifs = notifRes.data.notifications
    expect(notifs.length).toBe(14)

    const readStates = notifs.map((notif) => notif.isRead)
    expect(readStates).toEqual(notifs.map(() => false))

    // @TODO while the exact order of these is not critically important,
    // it's odd to see carol's follow after bob's. In the seed they occur in
    // the opposite ordering.
    expect(forSnapshot(notifs)).toMatchSnapshot()
  })

  it('paginates', async () => {
    const results = (results) => results.flatMap((res) => res.likedBy)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.getNotifications(
        {
          before: cursor,
          limit: 4,
        },
        undefined,
        { headers: sc.getHeaders(alice) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.notifications.length).toBeLessThanOrEqual(4),
    )

    const full = await client.app.bsky.getNotifications({}, undefined, {
      headers: sc.getHeaders(alice),
    })

    expect(full.data.notifications.length).toEqual(14)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('updates notifications last seen', async () => {
    const { db } = locals.get(app)

    const full = await client.app.bsky.getNotifications({}, undefined, {
      headers: sc.getHeaders(alice),
    })

    // Need to look-up createdAt time as a cursor since it's not in the method's output
    const beforeNotif = await db.db
      .selectFrom('user_notification')
      .selectAll()
      .where('recordUri', '=', full.data.notifications[3].uri)
      .executeTakeFirstOrThrow()

    await client.app.bsky.postNotificationsSeen(
      {},
      { seenAt: beforeNotif.indexedAt },
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )
  })

  it('fetches notification count with a last-seen', async () => {
    const notifCount = await client.app.bsky.getNotificationCount(
      {},
      undefined,
      { headers: sc.getHeaders(alice) },
    )

    expect(notifCount.data.count).toBe(3)
  })

  it('fetches notifications with a last-seen', async () => {
    const notifRes = await client.app.bsky.getNotifications({}, undefined, {
      headers: sc.getHeaders(alice),
    })

    const notifs = notifRes.data.notifications
    expect(notifs.length).toBe(14)

    const readStates = notifs.map((notif) => notif.isRead)
    expect(readStates).toEqual(notifs.map((_, i) => i >= 3))

    expect(forSnapshot(notifs)).toMatchSnapshot()
  })
})
