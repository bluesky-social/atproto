import { sql } from 'kysely'
import { ComAtprotoModerationDefs } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { toDatetimeString } from '@atproto/lex'
import { createInboxNotification } from '../src/inbox/notifications.js'
import { putNotificationPreferences } from '../src/inbox/preferences.js'
import {
  ackPushNotifications,
  claimPushNotifications,
} from '../src/inbox/push-outbox.js'
import { com, tools } from '../src/lexicons/index.js'
import { reportForEvent, resetInbox } from './_inbox.js'

describe('inbox push outbox', () => {
  let network: TestNetwork
  let sc: SeedClient
  const token = 'test-push-service-token'

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_inbox_push_outbox',
      ozone: { inboxPushEnabled: true, inboxPushToken: token },
    })
    sc = network.getSeedClient()
    await basicSeed(sc)
  })
  beforeEach(async () => resetInbox(network.ozone.ctx.db))
  afterAll(async () => network?.close())

  function notification(sourceKey: string) {
    return {
      recipientDid: sc.dids.bob,
      reason: 'standingChanged' as const,
      target: tools.ozone.inbox.defs.standingRef.$build({
        standing: 'warning',
      }),
      sourceKey,
      createdAt: toDatetimeString(new Date()),
    }
  }

  it('enqueues pushes from real report and moderation actions', async () => {
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef' as const,
      did: sc.dids.alice,
    }
    const event = await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject,
      reportedBy: sc.dids.bob,
    })
    await network.processAll()
    const report = await reportForEvent(network.ozone.getModClient(), event.id)
    await network.ozone.getAgent().tools.ozone.report.createActivity(
      {
        reportId: report.id,
        activity: { $type: 'tools.ozone.report.defs#closeActivity' },
        internalNote: 'private moderator note',
      },
      {
        headers: await network.ozone.modHeaders(
          'tools.ozone.report.createActivity',
        ),
      },
    )
    await network.ozone.getModClient().emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['spam'],
        negateLabelVals: [],
      },
      subject,
    })
    const { notifications } = await claimPushNotifications(
      network.ozone.ctx.db,
      10,
    )
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientDid: sc.dids.bob,
          reason: 'reportResolved',
          category: 'reports',
          target: expect.objectContaining({ reportId: report.id }),
        }),
        expect.objectContaining({
          recipientDid: sc.dids.alice,
          reason: 'actionTaken',
          category: 'labels',
        }),
      ]),
    )
    expect(JSON.stringify(notifications)).not.toContain(
      'private moderator note',
    )
  })

  it('enqueues once for newly inserted notifications and respects preferences', async () => {
    const db = network.ozone.ctx.db
    const input = notification('test:one')
    await createInboxNotification(db, input, undefined, true)
    await createInboxNotification(db, input, undefined, true)
    await putNotificationPreferences(db, sc.dids.bob, { account: false })
    await createInboxNotification(
      db,
      notification('test:disabled'),
      undefined,
      true,
    )
    expect(
      await db.db.selectFrom('inbox_notification').selectAll().execute(),
    ).toHaveLength(2)
    expect(
      await db.db.selectFrom('inbox_push_outbox').selectAll().execute(),
    ).toHaveLength(1)
    expect(await claimPushNotifications(db, 10)).toEqual({
      notifications: [],
      processed: 1,
      expired: 0,
      suppressed: 1,
    })
    expect(
      (await db.db.selectFrom('inbox_push_outbox').selectAll().execute())[0]
        .state,
    ).toBe('suppressed')
  })

  it('uses the correct preference for each produced reason and preserves history', async () => {
    const db = network.ozone.ctx.db
    const subject = com.atproto.admin.defs.repoRef.$build({ did: sc.dids.bob })
    const cases = [
      {
        reason: 'reportResolved',
        target: tools.ozone.inbox.defs.reportRef.$build({ reportId: 1 }),
        category: 'reports',
      },
      {
        reason: 'reportReopened',
        target: tools.ozone.inbox.defs.reportRef.$build({ reportId: 1 }),
        category: 'reports',
      },
      {
        reason: 'actionTaken',
        target: tools.ozone.inbox.defs.subjectRef.$build({
          subject,
          actionType: 'labelApplied',
        }),
        category: 'labels',
      },
      {
        reason: 'actionReversed',
        target: tools.ozone.inbox.defs.subjectRef.$build({
          subject,
          actionType: 'labelRemoved',
        }),
        category: 'labels',
      },
      {
        reason: 'actionTaken',
        target: tools.ozone.inbox.defs.subjectRef.$build({
          subject,
          actionType: 'takedown',
        }),
        category: 'account',
      },
      {
        reason: 'appealResolved',
        target: tools.ozone.inbox.defs.subjectRef.$build({ subject }),
        category: 'account',
      },
      {
        reason: 'standingChanged',
        target: tools.ozone.inbox.defs.standingRef.$build({
          standing: 'warning',
        }),
        category: 'account',
      },
    ] as const
    await putNotificationPreferences(db, sc.dids.bob, {
      reports: false,
      labels: false,
      account: true,
    })
    for (const [index, item] of cases.entries()) {
      await createInboxNotification(
        db,
        {
          recipientDid: sc.dids.bob,
          reason: item.reason,
          target: item.target,
          sourceKey: `test:category:${index}`,
        },
        undefined,
        true,
      )
    }
    expect(
      await db.db.selectFrom('inbox_notification').selectAll().execute(),
    ).toHaveLength(cases.length)
    const { notifications: claimed } = await claimPushNotifications(db, 10)
    expect(claimed.map((item) => item.category)).toEqual([
      'account',
      'account',
      'account',
    ])
    expect(claimed.map((item) => item.reason)).toEqual([
      'actionTaken',
      'appealResolved',
      'standingChanged',
    ])
  })

  it('fences concurrent claims and safely retries acknowledgement', async () => {
    const db = network.ozone.ctx.db
    await createInboxNotification(
      db,
      notification('test:claim'),
      undefined,
      true,
    )
    const [first, second] = await Promise.all([
      claimPushNotifications(db, 10),
      claimPushNotifications(db, 10),
    ])
    const claimed = [...first.notifications, ...second.notifications]
    expect(claimed).toHaveLength(1)
    const item = claimed[0]
    expect(
      await ackPushNotifications(db, [{ id: item.id, leaseToken: 'wrong' }]),
    ).toEqual([])
    await db.db
      .updateTable('inbox_push_outbox')
      .set({ leaseUntil: new Date(0) })
      .where('notificationId', '=', item.id)
      .execute()
    const {
      notifications: [retry],
    } = await claimPushNotifications(db, 10)
    expect(retry.id).toBe(item.id)
    expect(retry.leaseToken).not.toBe(item.leaseToken)
    expect(
      await ackPushNotifications(db, [
        { id: item.id, leaseToken: item.leaseToken },
      ]),
    ).toEqual([])
    expect(
      await ackPushNotifications(db, [
        { id: retry.id, leaseToken: retry.leaseToken },
      ]),
    ).toEqual([item.id])
    expect(
      await ackPushNotifications(db, [
        { id: retry.id, leaseToken: retry.leaseToken },
      ]),
    ).toEqual([item.id])
  })

  it('rejects an acknowledgement whose lease expires while waiting for its row lock', async () => {
    const db = network.ozone.ctx.db
    await createInboxNotification(
      db,
      notification('test:ack-wait'),
      undefined,
      true,
    )
    const {
      notifications: [item],
    } = await claimPushNotifications(db, 1)
    await db.db
      .updateTable('inbox_push_outbox')
      .set({ leaseUntil: new Date(Date.now() + 300) })
      .where('notificationId', '=', item.id)
      .execute()
    let release!: () => void
    let locked!: () => void
    const hold = new Promise<void>((resolve) => {
      release = resolve
    })
    const ready = new Promise<void>((resolve) => {
      locked = resolve
    })
    const locker = db.transaction(async (txn) => {
      await txn.db
        .selectFrom('inbox_push_outbox')
        .select('notificationId')
        .where('notificationId', '=', item.id)
        .forUpdate()
        .execute()
      locked()
      await hold
    })
    await ready
    try {
      const ack = ackPushNotifications(db, [
        { id: item.id, leaseToken: item.leaseToken },
      ])
      await new Promise((resolve) => setTimeout(resolve, 500))
      release()
      expect(await ack).toEqual([])
    } finally {
      release()
      await locker
    }
  })

  it('skips locked retention rows while claiming new work', async () => {
    const db = network.ozone.ctx.db
    await createInboxNotification(
      db,
      notification('test:finished'),
      undefined,
      true,
    )
    const {
      notifications: [item],
    } = await claimPushNotifications(db, 1)
    await ackPushNotifications(db, [
      { id: item.id, leaseToken: item.leaseToken },
    ])
    await db.db
      .updateTable('inbox_push_outbox')
      .set({ finishedAt: new Date(Date.now() - 8 * 24 * 60 * 60_000) })
      .where('notificationId', '=', item.id)
      .execute()
    await createInboxNotification(
      db,
      notification('test:pending'),
      undefined,
      true,
    )
    let release!: () => void
    let locked!: () => void
    const hold = new Promise<void>((resolve) => {
      release = resolve
    })
    const ready = new Promise<void>((resolve) => {
      locked = resolve
    })
    const locker = db.transaction(async (txn) => {
      await txn.db
        .selectFrom('inbox_push_outbox')
        .select('notificationId')
        .where('notificationId', '=', item.id)
        .forUpdate()
        .execute()
      locked()
      await hold
    })
    await ready
    try {
      const claim = claimPushNotifications(db, 1)
      const beforeRelease = await Promise.race([
        claim.then(() => true),
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), 500),
        ),
      ])
      release()
      expect(beforeRelease).toBe(true)
      expect((await claim).notifications).toHaveLength(1)
    } finally {
      release()
      await locker
    }
  })

  it('expires stale work without changing inbox history', async () => {
    const db = network.ozone.ctx.db
    await createInboxNotification(
      db,
      {
        ...notification('test:expired'),
        createdAt: toDatetimeString(new Date(Date.now() - 61 * 60_000)),
      },
      undefined,
      true,
    )
    expect(await claimPushNotifications(db, 10)).toEqual({
      notifications: [],
      processed: 1,
      expired: 1,
      suppressed: 0,
    })
    expect(
      (await db.db.selectFrom('inbox_push_outbox').selectAll().execute())[0]
        .state,
    ).toBe('expired')
    expect(
      await db.db.selectFrom('inbox_notification').selectAll().execute(),
    ).toHaveLength(1)
  })

  it('reports a full expired batch so the consumer can immediately reach newer work', async () => {
    const db = network.ozone.ctx.db
    await createInboxNotification(
      db,
      {
        ...notification('test:old'),
        createdAt: toDatetimeString(new Date(Date.now() - 61 * 60_000)),
      },
      undefined,
      true,
    )
    await createInboxNotification(db, notification('test:new'), undefined, true)
    expect(await claimPushNotifications(db, 1)).toEqual({
      notifications: [],
      processed: 1,
      expired: 1,
      suppressed: 0,
    })
    const next = await claimPushNotifications(db, 1)
    expect(next.processed).toBe(1)
    expect(next.notifications).toHaveLength(1)
  })

  it('retains inbox history when an outbox insert fails', async () => {
    const db = network.ozone.ctx.db
    await sql`create function fail_inbox_push() returns trigger language plpgsql as $$ begin raise exception 'push test failure'; end $$`.execute(
      db.db,
    )
    await sql`create trigger fail_inbox_push before insert on inbox_push_outbox for each statement execute function fail_inbox_push()`.execute(
      db.db,
    )
    try {
      await createInboxNotification(
        db,
        notification('test:failure'),
        undefined,
        true,
      )
      expect(
        await db.db.selectFrom('inbox_notification').selectAll().execute(),
      ).toHaveLength(1)
      expect(
        await db.db.selectFrom('inbox_push_outbox').selectAll().execute(),
      ).toHaveLength(0)
    } finally {
      await sql`drop trigger fail_inbox_push on inbox_push_outbox`.execute(
        db.db,
      )
      await sql`drop function fail_inbox_push()`.execute(db.db)
    }
  })

  it('bounds outbox lock waits and restores the source transaction setting', async () => {
    const db = network.ozone.ctx.db
    let release!: () => void
    let locked!: () => void
    const hold = new Promise<void>((resolve) => {
      release = resolve
    })
    const ready = new Promise<void>((resolve) => {
      locked = resolve
    })
    const locker = db.transaction(async (txn) => {
      await sql`lock table inbox_push_outbox in access exclusive mode`.execute(
        txn.db,
      )
      locked()
      await hold
    })
    await ready
    try {
      await db.transaction(async (txn) => {
        await sql`set local lock_timeout = '100ms'`.execute(txn.db)
        await createInboxNotification(
          txn,
          notification('test:locked'),
          undefined,
          true,
        )
        const setting = await sql<{
          value: string
        }>`select current_setting('lock_timeout') as value`.execute(txn.db)
        expect(setting.rows[0].value).toBe('100ms')
      })
      expect(
        await db.db.selectFrom('inbox_notification').selectAll().execute(),
      ).toHaveLength(1)
    } finally {
      release()
      await locker
    }
    expect(
      await db.db.selectFrom('inbox_push_outbox').selectAll().execute(),
    ).toHaveLength(0)
  })

  it('restricts the cross-account consumer to its configured credential', async () => {
    const url = `${network.ozone.url}/xrpc/tools.ozone.inbox.claimPushNotifications`
    const request = (credential?: string) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(credential && { authorization: credential }),
        },
        body: JSON.stringify({ limit: 10 }),
      })
    await createInboxNotification(
      network.ozone.ctx.db,
      notification('test:auth'),
      undefined,
      true,
    )
    expect((await request()).status).toBe(401)
    expect((await request('Bearer invalid')).status).toBe(401)
    const response = await request(`Bearer ${token}`)
    expect(response.status).toBe(200)
    expect((await response.json()).notifications).toHaveLength(1)
  })
})
