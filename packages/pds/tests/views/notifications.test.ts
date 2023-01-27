import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/moderationAction'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
  paginateAll,
  adminAuth,
} from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { Database } from '../../src'
import { Notification } from '../../src/lexicon/types/app/bsky/notification/list'

describe('pds notification views', () => {
  let client: AtpServiceClient
  let close: CloseFn
  let db: Database
  let sc: SeedClient

  // account dids, for convenience
  let alice: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_notifications',
    })
    close = server.close
    db = server.ctx.db
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc, server.ctx.messageQueue)
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

    expect(notifCount.data.count).toBe(9)
  })

  it('fetches notifications without a last-seen', async () => {
    const notifRes = await client.app.bsky.notification.list(
      {},
      { headers: sc.getHeaders(alice) },
    )

    const notifs = sort(notifRes.data.notifications)
    expect(notifs.length).toBe(9)

    const readStates = notifs.map((notif) => notif.isRead)
    expect(readStates).toEqual(notifs.map(() => false))

    // @TODO while the exact order of these is not critically important,
    // it's odd to see carol's follow after bob's. In the seed they occur in
    // the opposite ordering.
    expect(forSnapshot(notifs)).toMatchSnapshot()
  })

  it('fetches notifications omitting mentions and replies by a muted user', async () => {
    await client.app.bsky.graph.mute(
      { user: sc.dids.carol }, // Replier
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await client.app.bsky.graph.mute(
      { user: sc.dids.dan }, // Mentioner
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )

    const notifRes = await client.app.bsky.notification.list(
      {},
      { headers: sc.getHeaders(alice) },
    )
    const notifCount = await client.app.bsky.notification.getCount(
      {},
      { headers: sc.getHeaders(alice) },
    )

    const notifs = sort(notifRes.data.notifications)
    expect(notifs.length).toBe(7)
    expect(forSnapshot(notifs)).toMatchSnapshot()
    expect(notifCount.data.count).toBe(7)

    // Cleanup
    await client.app.bsky.graph.unmute(
      { user: sc.dids.carol },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await client.app.bsky.graph.unmute(
      { user: sc.dids.dan },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
  })

  it('fetches notifications omitting mentions and replies for taken-down posts', async () => {
    const postUri1 = sc.replies[sc.dids.carol][0].ref.uri // Reply
    const postUri2 = sc.posts[sc.dids.dan][1].ref.uri // Mention
    const actionResults = await Promise.all(
      [postUri1, postUri2].map((postUri) =>
        client.com.atproto.admin.takeModerationAction(
          {
            action: TAKEDOWN,
            subject: {
              $type: 'com.atproto.repo.recordRef',
              uri: postUri.toString(),
            },
            createdBy: 'X',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        ),
      ),
    )

    const notifRes = await client.app.bsky.notification.list(
      {},
      { headers: sc.getHeaders(alice) },
    )
    const notifCount = await client.app.bsky.notification.getCount(
      {},
      { headers: sc.getHeaders(alice) },
    )

    const notifs = sort(notifRes.data.notifications)
    expect(notifs.length).toBe(7)
    expect(forSnapshot(notifs)).toMatchSnapshot()
    expect(notifCount.data.count).toBe(7)

    // Cleanup
    await Promise.all(
      actionResults.map((result) =>
        client.com.atproto.admin.reverseModerationAction(
          {
            id: result.data.id,
            createdBy: 'X',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        ),
      ),
    )
  })

  it('paginates', async () => {
    const results = (results) =>
      sort(results.flatMap((res) => res.notifications))
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.notification.list(
        {
          before: cursor,
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

    const full = await client.app.bsky.notification.list(
      {},
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(full.data.notifications.length).toEqual(9)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('updates notifications last seen', async () => {
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
      .where('recordUri', '=', full.data.notifications[3].uri)
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

    expect(notifCount.data.count).toBe(3)
  })

  it('fetches notifications with a last-seen', async () => {
    const notifRes = await client.app.bsky.notification.list(
      {},
      {
        headers: sc.getHeaders(alice),
      },
    )

    const notifs = sort(notifRes.data.notifications)
    expect(notifs.length).toBe(9)

    const readStates = notifs.map((notif) => notif.isRead)
    expect(readStates).toEqual(notifs.map((_, i) => i >= 3))

    expect(forSnapshot(notifs)).toMatchSnapshot()
  })
})
