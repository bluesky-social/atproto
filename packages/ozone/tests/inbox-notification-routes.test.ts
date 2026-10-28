import { type Kysely, sql } from 'kysely'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { type DidString, toDatetimeString } from '@atproto/lex'
import {
  down,
  up,
} from '../src/db/migrations/20261012T000000000Z-inbox-notification-categories.js'
import { createInboxNotification } from '../src/inbox/notifications.js'
import {
  getNotificationPreferences,
  putNotificationPreferences,
} from '../src/inbox/preferences.js'
import { tools } from '../src/lexicons/index.js'
import { inboxHeaders, resetInbox } from './_inbox.js'

describe('viewer notification routes', () => {
  let network: TestNetwork
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_inbox_notification_routes_body',
    })
    sc = network.getSeedClient()
    await basicSeed(sc)
    await resetInbox(network.ozone.ctx.db)
    await network.ozone.addModeratorDid(sc.dids.alice)
    await network.ozone.addTriageDid(sc.dids.dan)
  })
  afterAll(async () => network?.close())

  function query(did: DidString, method: string, params: object = {}) {
    return sc.agent.call(method, params, undefined, {
      headers: inboxHeaders(network, sc, did),
    })
  }
  function procedure(did: DidString, method: string, input: object) {
    return sc.agent.call(method, {}, input, {
      headers: inboxHeaders(network, sc, did),
    })
  }

  it('migrates existing global values without backfilling and can roll back the schema', async () => {
    await network.ozone.ctx.db.transaction(async (tx) => {
      // @NOTE A temporary table shadows the live table for this transaction.
      await sql`create temporary table inbox_notification_preference (
        did varchar primary key, push boolean not null default true
      ) on commit drop`.execute(tx.db)
      await tx.db
        .insertInto('inbox_notification_preference')
        .values([
          { did: sc.dids.bob, push: false },
          { did: sc.dids.carol, push: true },
          { did: sc.dids.dan, push: false },
        ])
        .execute()
      const migrationDb = tx.db as unknown as Kysely<unknown>
      await up(migrationDb)
      expect(await getNotificationPreferences(tx, sc.dids.bob)).toEqual({
        reports: false,
        account: false,
        labels: false,
      })
      expect(await getNotificationPreferences(tx, sc.dids.carol)).toEqual({
        reports: true,
        account: true,
        labels: true,
      })
      const row = await tx.db
        .selectFrom('inbox_notification_preference')
        .select(['reports', 'account', 'labels'])
        .where('did', '=', sc.dids.bob)
        .executeTakeFirstOrThrow()
      expect(row).toEqual({ reports: null, account: null, labels: null })
      await putNotificationPreferences(tx, sc.dids.carol, { labels: false })
      await putNotificationPreferences(tx, sc.dids.dan, {
        reports: true,
        account: true,
        labels: true,
      })
      await down(migrationDb)
      const legacy = await tx.db
        .selectFrom('inbox_notification_preference')
        .select(['did', 'push'])
        .execute()
      expect(legacy).toEqual(
        expect.arrayContaining([
          { did: sc.dids.bob, push: false },
          { did: sc.dids.carol, push: false },
          { did: sc.dids.dan, push: true },
        ]),
      )
    })
  })

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
    expect(initial.data.preferences).toEqual({
      reports: true,
      account: true,
      labels: true,
    })
    const changed = await procedure(
      sc.dids.bob,
      'tools.ozone.inbox.putNotificationPreferences',
      { reports: false },
    )
    expect(changed.data.preferences).toEqual({
      reports: false,
      account: true,
      labels: true,
    })
    const persisted = await query(
      sc.dids.bob,
      'tools.ozone.inbox.getNotificationPreferences',
    )
    expect(persisted.data.preferences).toEqual(changed.data.preferences)
    const carolPrefs = await query(
      sc.dids.carol,
      'tools.ozone.inbox.getNotificationPreferences',
    )
    expect(carolPrefs.data.preferences).toEqual(initial.data.preferences)
  })

  it('retains independent toggles during concurrent updates and can re-enable them', async () => {
    await Promise.all([
      procedure(
        sc.dids.bob,
        tools.ozone.inbox.putNotificationPreferences.$lxm,
        {
          account: false,
        },
      ),
      procedure(
        sc.dids.bob,
        tools.ozone.inbox.putNotificationPreferences.$lxm,
        {
          labels: false,
        },
      ),
    ])
    const disabled = await query(
      sc.dids.bob,
      tools.ozone.inbox.getNotificationPreferences.$lxm,
    )
    expect(disabled.data.preferences).toEqual({
      reports: false,
      account: false,
      labels: false,
    })
    const enabled = await procedure(
      sc.dids.bob,
      tools.ozone.inbox.putNotificationPreferences.$lxm,
      { reports: true, labels: true },
    )
    expect(enabled.data.preferences).toEqual({
      reports: true,
      account: false,
      labels: true,
    })
  })

  it('preserves global opt-outs for unset categories and permits independent overrides', async () => {
    // @NOTE This legacy row cannot be created through the category-only endpoint.
    await network.ozone.ctx.db.db
      .insertInto('inbox_notification_preference')
      .values({ did: sc.dids.dan, push: false })
      .execute()
    const initial = await query(
      sc.dids.dan,
      tools.ozone.inbox.getNotificationPreferences.$lxm,
    )
    expect(initial.data.preferences).toEqual({
      reports: false,
      account: false,
      labels: false,
    })
    const changed = await procedure(
      sc.dids.dan,
      tools.ozone.inbox.putNotificationPreferences.$lxm,
      { labels: true },
    )
    expect(changed.data.preferences).toEqual({
      reports: false,
      account: false,
      labels: true,
    })
    expect(
      (
        await query(
          sc.dids.dan,
          tools.ozone.inbox.getNotificationPreferences.$lxm,
        )
      ).data.preferences,
    ).toEqual(changed.data.preferences)
  })

  it('rejects missing categories and invalid boolean values without changing preferences', async () => {
    const before = await query(
      sc.dids.bob,
      tools.ozone.inbox.getNotificationPreferences.$lxm,
    )
    for (const input of [
      {},
      { push: false },
      { labels: 'false' },
      { account: null },
    ]) {
      await expect(
        procedure(
          sc.dids.bob,
          tools.ozone.inbox.putNotificationPreferences.$lxm,
          input,
        ),
      ).rejects.toMatchObject({ error: 'InvalidRequest' })
    }
    expect(
      (
        await query(
          sc.dids.bob,
          tools.ozone.inbox.getNotificationPreferences.$lxm,
        )
      ).data.preferences,
    ).toEqual(before.data.preferences)
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
    for (const section of ['reports', 'subjects']) {
      const response = await procedure(
        sc.dids.carol,
        'tools.ozone.inbox.updateSeen',
        { sections: [section], seenAt: past },
      )
      expect(response.data.seenAt).toBe(newer)
    }
  })

  it('allows staff to preview recipient data without changing read state or preferences', async () => {
    await createInboxNotification(network.ozone.ctx.db, {
      recipientDid: sc.dids.carol,
      reason: 'actionTaken',
      target: tools.ozone.inbox.defs.subjectRef.$build({
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.carol,
        },
      }),
      sourceKey: 'preview:carol',
    })
    await procedure(
      sc.dids.carol,
      'tools.ozone.inbox.putNotificationPreferences',
      { reports: false, account: true, labels: false },
    )
    const methods = [
      'tools.ozone.inbox.listNotifications',
      'tools.ozone.inbox.getUnreadCount',
      'tools.ozone.inbox.getNotificationPreferences',
      'tools.ozone.inbox.getAccountStatus',
    ]
    const expected = await Promise.all(
      methods.map((method) => query(sc.dids.carol, method)),
    )
    for (const viewer of [sc.dids.alice, sc.dids.dan]) {
      for (const [index, method] of methods.entries()) {
        const preview = await query(viewer, method, { did: sc.dids.carol })
        expect(preview.data).toEqual(expected[index].data)
      }
    }
    for (const [index, method] of methods.entries()) {
      expect((await query(sc.dids.carol, method)).data).toEqual(
        expected[index].data,
      )
      expect(
        (await query(sc.dids.carol, method, { did: sc.dids.carol })).data,
      ).toEqual(expected[index].data)
      await expect(
        query(sc.dids.bob, method, { did: sc.dids.carol }),
      ).rejects.toMatchObject({ error: 'Forbidden' })
    }
  })

  it('never applies writes to a preview DID supplied by staff', async () => {
    const before = await query(
      sc.dids.carol,
      'tools.ozone.inbox.listNotifications',
    )
    await procedure(sc.dids.alice, 'tools.ozone.inbox.updateSeen', {
      sections: ['subjects'],
      did: sc.dids.carol,
    })
    await procedure(
      sc.dids.alice,
      'tools.ozone.inbox.putNotificationPreferences',
      { reports: true, account: false, labels: true, did: sc.dids.carol },
    )
    expect(
      (await query(sc.dids.carol, 'tools.ozone.inbox.listNotifications')).data,
    ).toEqual(before.data)
    expect(
      (
        await query(
          sc.dids.carol,
          'tools.ozone.inbox.getNotificationPreferences',
        )
      ).data.preferences,
    ).toEqual({ reports: false, account: true, labels: false })
  })
})
