import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { type DidString, toDatetimeString } from '@atproto/lex'
import { createInboxNotification } from '../src/inbox/notifications.js'
import { com, tools } from '../src/lexicons/index.js'
import { inboxHeaders, reportForEvent, resetInbox } from './_inbox.js'

describe('notification history cutoff', () => {
  let network: TestNetwork
  let sc: SeedClient
  const startAt = toDatetimeString(Date.now() - 60_000)
  const beforeStart = toDatetimeString(new Date(startAt).getTime() - 1)

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_inbox_notification_start',
    })
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    await resetInbox(network.ozone.ctx.db)
    network.ozone.ctx.cfg.inbox.startAt = startAt
  })
  afterAll(async () => network?.close())
  afterEach(() => {
    if (network) network.ozone.ctx.cfg.inbox.startAt = startAt
  })

  function query(did: DidString, method: string, params: object = {}) {
    return sc.agent.call(method, params, undefined, {
      headers: inboxHeaders(network, sc, did),
    })
  }

  it('skips pre-cutoff writes and keeps boundary notifications unread', async () => {
    const db = network.ozone.ctx.db
    const input = {
      recipientDid: sc.dids.bob,
      reason: 'standingChanged' as const,
      target: tools.ozone.inbox.defs.standingRef.$build({
        standing: 'warning',
      }),
      sourceKey: 'cutoff:before',
      createdAt: beforeStart,
    }
    await createInboxNotification(db, input, startAt)
    await createInboxNotification(
      db,
      {
        ...input,
        sourceKey: 'cutoff:boundary',
        createdAt: startAt,
      },
      startAt,
    )
    expect(
      await db.db.selectFrom('inbox_notification').select('id').execute(),
    ).toHaveLength(1)
    const { data } = await query(
      sc.dids.bob,
      tools.ozone.inbox.listNotifications.$lxm,
      { unreadOnly: true },
    )
    expect(data.notifications).toHaveLength(1)
    expect(data.notifications[0]).toMatchObject({
      createdAt: startAt,
      isRead: false,
    })
    const counts = await query(
      sc.dids.bob,
      tools.ozone.inbox.getUnreadCount.$lxm,
    )
    expect(counts.data.unreadCounts).toMatchObject({
      total: 1,
      accountStatus: 1,
    })
  })

  it('applies the same target visibility to notification lists and counts', async () => {
    const db = network.ozone.ctx.db
    const mod = network.ozone.getModClient()
    const subject = com.atproto.admin.defs.repoRef.$build({
      did: sc.dids.alice,
    })
    const oldReport = await sc.createReport({
      reasonType: com.atproto.moderation.defs.ReasonSpam,
      subject,
      reportedBy: sc.dids.bob,
    })
    const visibleReport = await sc.createReport({
      reasonType: com.atproto.moderation.defs.ReasonSpam,
      subject,
      reportedBy: sc.dids.bob,
    })
    await network.processAll()
    const oldId = (await reportForEvent(mod, oldReport.id)).id
    const visibleId = (await reportForEvent(mod, visibleReport.id)).id
    await db.db
      .updateTable('report')
      .set({ createdAt: beforeStart })
      .where('id', '=', oldId)
      .execute()
    await db.db
      .updateTable('report')
      .set({ createdAt: startAt })
      .where('id', '=', visibleId)
      .execute()
    for (const reportId of [oldId, visibleId, 2147483648]) {
      await createInboxNotification(db, {
        recipientDid: sc.dids.bob,
        reason: 'reportResolved',
        target: tools.ozone.inbox.defs.reportRef.$build({
          reportId,
          status: 'resolved',
        }),
        sourceKey: `cutoff:report:${reportId}`,
        createdAt: startAt,
      })
    }
    // Legacy rows still have to be filtered if they predate the configured start.
    await createInboxNotification(db, {
      recipientDid: sc.dids.bob,
      reason: 'standingChanged',
      target: tools.ozone.inbox.defs.standingRef.$build({
        standing: 'warning',
      }),
      sourceKey: 'cutoff:legacy-before',
      createdAt: beforeStart,
    })
    const list = await query(
      sc.dids.bob,
      tools.ozone.inbox.listNotifications.$lxm,
      { section: 'reports' },
    )
    expect(
      list.data.notifications.map(
        (n: { target: { reportId: number } }) => n.target.reportId,
      ),
    ).toEqual([visibleId])
    const count = await query(
      sc.dids.bob,
      tools.ozone.inbox.getUnreadCount.$lxm,
      { section: 'reports' },
    )
    expect(count.data.unreadCounts.total).toBe(1)
    const total = await query(
      sc.dids.bob,
      tools.ozone.inbox.getUnreadCount.$lxm,
    )
    expect(total.data.unreadCounts).toMatchObject({
      total: 2,
      reports: 1,
      accountStatus: 1,
    })
  })

  it('hides all notifications and skips writes before a future launch', async () => {
    const db = network.ozone.ctx.db
    const before = await db.db
      .selectFrom('inbox_notification')
      .select('id')
      .execute()
    const future = toDatetimeString(Date.now() + 60_000)
    network.ozone.ctx.cfg.inbox.startAt = future
    await createInboxNotification(
      db,
      {
        recipientDid: sc.dids.bob,
        reason: 'standingChanged',
        target: tools.ozone.inbox.defs.standingRef.$build({
          standing: 'warning',
        }),
        sourceKey: 'cutoff:future',
        createdAt: future,
      },
      future,
    )
    expect(
      await db.db.selectFrom('inbox_notification').select('id').execute(),
    ).toEqual(before)
    const list = await query(
      sc.dids.bob,
      tools.ozone.inbox.listNotifications.$lxm,
    )
    expect(list.data.notifications).toEqual([])
    expect(list.data.cursor).toBeUndefined()
    const count = await query(
      sc.dids.bob,
      tools.ozone.inbox.getUnreadCount.$lxm,
    )
    expect(count.data.unreadCounts).toEqual({
      total: 0,
      reports: 0,
      subjects: 0,
      accountStatus: 0,
    })
  })
})
