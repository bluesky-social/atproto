import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { type DidString, toDatetimeString } from '@atproto/lex'
import {
  createInboxNotification,
  listInboxNotifications,
} from '../src/inbox/notifications.js'
import { tools } from '../src/lexicons/index.js'

describe('viewer notification routes', () => {
  let network: TestNetwork
  let sc: SeedClient
  let proxyHeader: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_inbox_notification_routes_body',
    })
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.ozone.ctx.db.db.deleteFrom('inbox_notification').execute()
    await network.ozone.ctx.db.db
      .deleteFrom('inbox_notification_preference')
      .execute()
    await network.ozone.ctx.db.db.deleteFrom('inbox_seen').execute()
    proxyHeader = `${network.ozone.ctx.cfg.service.did}#atproto_labeler`
  })
  afterAll(async () => network?.close())

  function query(did: DidString, method: string, params: object = {}) {
    return sc.agent.call(method, params, undefined, {
      headers: { ...sc.getHeaders(did), 'atproto-proxy': proxyHeader },
    })
  }
  function procedure(did: DidString, method: string, input: object) {
    return sc.agent.call(method, {}, input, {
      headers: { ...sc.getHeaders(did), 'atproto-proxy': proxyHeader },
    })
  }

  it('lists only recipient notifications with a stable cursor and idempotent source key', async () => {
    const db = network.ozone.ctx.db
    const target = tools.ozone.inbox.defs.standingRef.$build({
      standing: 'warning',
    })
    const first = {
      recipientDid: sc.dids.bob,
      reason: 'standingChanged' as const,
      target,
      sourceKey: 'test:notification:first',
      createdAt: toDatetimeString('2026-01-01T00:00:00.000Z'),
    }
    await db.transaction(async (tx) => {
      await createInboxNotification(tx, first)
      await createInboxNotification(tx, first)
    })
    await createInboxNotification(db, {
      ...first,
      sourceKey: 'test:notification:second',
    })
    await createInboxNotification(db, {
      ...first,
      recipientDid: sc.dids.carol,
      sourceKey: 'test:notification:carol',
    })

    const directRows = await db.db
      .selectFrom('inbox_notification')
      .selectAll()
      .execute()
    expect(directRows).toHaveLength(3)
    expect(directRows.map((r) => r.recipientDid)).toEqual([
      sc.dids.bob,
      sc.dids.bob,
      sc.dids.carol,
    ])
    expect(
      (
        await listInboxNotifications(db, sc.dids.bob, {
          unreadOnly: false,
          limit: 50,
        })
      ).notifications,
    ).toHaveLength(2)
    const { data: page1 } = await query(
      sc.dids.bob,
      'tools.ozone.inbox.listNotifications',
      { limit: 1 },
    )
    const { data: page2 } = await query(
      sc.dids.bob,
      'tools.ozone.inbox.listNotifications',
      { limit: 1, cursor: page1.cursor },
    )
    expect(page1.notifications).toHaveLength(1)
    expect(page2.notifications).toHaveLength(1)
    expect(page1.notifications[0].id).not.toBe(page2.notifications[0].id)
    expect(page2.cursor).toBeUndefined()
    const { data: carol } = await query(
      sc.dids.carol,
      'tools.ozone.inbox.listNotifications',
    )
    expect(carol.notifications).toHaveLength(1)
    await expect(
      query(sc.dids.bob, 'tools.ozone.inbox.listNotifications', {
        cursor: 'invalid',
      }),
    ).rejects.toMatchObject({ error: 'InvalidRequest' })
  })

  it('advertises the in-app capability', async () => {
    const { data } = await query(
      sc.dids.bob,
      'tools.ozone.server.getCapabilities',
    )
    expect(data.notifications.channels).toContain('inApp')
  })

  it('applies section watermarks and preferences only to the authenticated account', async () => {
    const before = await query(sc.dids.bob, 'tools.ozone.inbox.getUnreadCount')
    expect(before.data.unreadCounts.accountStatus).toBe(1)
    const seen = await procedure(sc.dids.bob, 'tools.ozone.inbox.updateSeen', {
      sections: ['accountStatus'],
    })
    expect(seen.data.seenAt).toBeDefined()
    const unread = await query(
      sc.dids.bob,
      'tools.ozone.inbox.listNotifications',
      { unreadOnly: true },
    )
    expect(unread.data.notifications).toHaveLength(0)
    const all = await query(sc.dids.bob, 'tools.ozone.inbox.listNotifications')
    expect(
      all.data.notifications.every((n: { isRead: boolean }) => n.isRead),
    ).toBe(true)
    const bobCount = await query(
      sc.dids.bob,
      'tools.ozone.inbox.getUnreadCount',
      { section: 'accountStatus' },
    )
    expect(bobCount.data.unreadCounts).toEqual({ total: 0 })
    const carolCount = await query(
      sc.dids.carol,
      'tools.ozone.inbox.getUnreadCount',
    )
    expect(carolCount.data.unreadCounts.accountStatus).toBe(1)

    const initial = await query(
      sc.dids.bob,
      'tools.ozone.inbox.getNotificationPreferences',
    )
    expect(initial.data.preferences.push).toBe(true)
    const changed = await procedure(
      sc.dids.bob,
      'tools.ozone.inbox.putNotificationPreferences',
      { push: false },
    )
    expect(changed.data.preferences.push).toBe(false)
    const persisted = await query(
      sc.dids.bob,
      'tools.ozone.inbox.getNotificationPreferences',
    )
    expect(persisted.data.preferences.push).toBe(false)
    const carolPrefs = await query(
      sc.dids.carol,
      'tools.ozone.inbox.getNotificationPreferences',
    )
    expect(carolPrefs.data.preferences.push).toBe(true)
  })
  it('filters by section and reason, and keeps section read state independent', async () => {
    const db = network.ozone.ctx.db
    await createInboxNotification(db, {
      recipientDid: sc.dids.bob,
      reason: 'reportResolved',
      target: tools.ozone.inbox.defs.reportRef.$build({
        reportId: 123,
        status: 'resolved',
      }),
      sourceKey: 'test:notification:report',
    })
    await createInboxNotification(db, {
      recipientDid: sc.dids.bob,
      reason: 'actionTaken',
      target: tools.ozone.inbox.defs.subjectRef.$build({
        subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.bob },
      }),
      sourceKey: 'test:notification:subject',
    })
    const reports = await query(
      sc.dids.bob,
      'tools.ozone.inbox.listNotifications',
      { section: 'reports' },
    )
    expect(
      reports.data.notifications.map((n: { reason: string }) => n.reason),
    ).toEqual(['reportResolved'])
    const subjects = await query(
      sc.dids.bob,
      'tools.ozone.inbox.listNotifications',
      { reasons: ['actionTaken'] },
    )
    expect(
      subjects.data.notifications.map((n: { reason: string }) => n.reason),
    ).toEqual(['actionTaken'])
    await procedure(sc.dids.bob, 'tools.ozone.inbox.updateSeen', {
      sections: ['reports'],
    })
    const counts = await query(sc.dids.bob, 'tools.ozone.inbox.getUnreadCount')
    expect(counts.data.unreadCounts).toMatchObject({
      reports: 0,
      subjects: 1,
      accountStatus: 0,
      total: 1,
    })
  })

  it('clamps future timestamps and keeps concurrent seen updates monotonic', async () => {
    const future = toDatetimeString(Date.now() + 60_000)
    const past = toDatetimeString(Date.now() - 60_000)
    const [first, second] = await Promise.all([
      procedure(sc.dids.carol, 'tools.ozone.inbox.updateSeen', {
        sections: ['reports', 'subjects'],
        seenAt: future,
      }),
      procedure(sc.dids.carol, 'tools.ozone.inbox.updateSeen', {
        sections: ['reports', 'subjects'],
        seenAt: past,
      }),
    ])
    const newer =
      first.data.seenAt > second.data.seenAt
        ? first.data.seenAt
        : second.data.seenAt
    const repeat = await procedure(
      sc.dids.carol,
      'tools.ozone.inbox.updateSeen',
      { sections: ['reports', 'subjects'], seenAt: past },
    )
    expect(Date.parse(first.data.seenAt)).toBeLessThan(Date.parse(future))
    expect(repeat.data.seenAt).toBe(newer)
    const rows = await network.ozone.ctx.db.db
      .selectFrom('inbox_seen')
      .where('did', '=', sc.dids.carol)
      .where('section', 'in', ['reports', 'subjects'])
      .select(['section', 'seenAt'])
      .execute()
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.seenAt === newer)).toBe(true)
  })
})
