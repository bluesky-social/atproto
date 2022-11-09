import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { runTestServer, forSnapshot, CloseFn, paginateAll } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import * as locals from '../../src/locals'
import { App } from '../../src'
import { Notification } from '../../src/lexicon/types/app/bsky/notification/list'

describe('pds notification views', () => {
  let client: AtpServiceClient
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
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc)
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
    const notifCount = await client.app.bsky.notification.getCount(
      {},
      { headers: sc.getHeaders(alice) },
    )

    expect(notifCount.data.count).toBe(14)
  })

  it('fetches notifications without a last-seen', async () => {
    const notifRes = await client.app.bsky.notification.list(
      {},
      {
        headers: sc.getHeaders(alice),
      },
    )

    const notifs = sort(notifRes.data.notifications)
    expect(notifs.length).toBe(14)

    const readStates = notifs.map((notif) => notif.isRead)
    expect(readStates).toEqual(notifs.map(() => false))

    // @TODO while the exact order of these is not critically important,
    // it's odd to see carol's follow after bob's. In the seed they occur in
    // the opposite ordering.
    expect(forSnapshot(notifs)).toMatchSnapshot()
  })

  it('paginates', async () => {
    const results = (results) =>
      sort(results.flatMap((res) => res.notifications))
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.notification.list(
        {
          before: cursor,
          limit: 4,
        },
        { headers: sc.getHeaders(alice) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.notifications.length).toBeLessThanOrEqual(4),
    )

    const full = await client.app.bsky.notification.list(
      {},
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(full.data.notifications.length).toEqual(14)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('updates notifications last seen', async () => {
    const { db } = locals.get(app)

    const full = await client.app.bsky.notification.list(
      {},
      {
        headers: sc.getHeaders(alice),
      },
    )

    // Need to look-up createdAt time as a cursor since it's not in the method's output
    const beforeNotif = await db.db
      .selectFrom('user_notification')
      .selectAll()
      .where('recordUri', '=', full.data.notifications[4].uri)
      .executeTakeFirstOrThrow()

    await client.app.bsky.notification.updateSeen(
      { seenAt: beforeNotif.indexedAt },
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )
  })

  it('fetches notification count with a last-seen', async () => {
    const notifCount = await client.app.bsky.notification.getCount(
      {},
      { headers: sc.getHeaders(alice) },
    )

    expect(notifCount.data.count).toBe(4)
  })

  it('fetches notifications with a last-seen', async () => {
    const notifRes = await client.app.bsky.notification.list(
      {},
      {
        headers: sc.getHeaders(alice),
      },
    )

    const notifs = sort(notifRes.data.notifications)
    expect(notifs.length).toBe(14)

    const readStates = notifs.map((notif) => notif.isRead)
    expect(readStates).toEqual(notifs.map((_, i) => i >= 4))

    expect(forSnapshot(notifs)).toMatchSnapshot()
  })
})
