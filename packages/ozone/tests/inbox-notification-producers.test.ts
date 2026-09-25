import { ComAtprotoModerationDefs } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { APPEAL_REASON_TYPE } from '../src/inbox/appeal.js'
import { closeReportsForSubject } from '../src/mod-service/report.js'
import { createReportActivity } from '../src/report/activity.js'

describe('inbox notification producers', () => {
  let network: TestNetwork
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_inbox_notification_producers_body',
    })
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })
  afterAll(async () => network?.close())

  it('writes report transitions and public notes atomically for the reporter', async () => {
    const event = await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      reportedBy: sc.dids.bob,
    })
    await network.processAll()
    const db = network.ozone.ctx.db
    const report = await db.db
      .selectFrom('report')
      .select('id')
      .where('eventId', '=', event.id)
      .executeTakeFirstOrThrow()

    await createReportActivity(db, {
      reportId: report.id,
      activityType: 'closeActivity',
      publicNote: 'Reviewed',
      createdBy: sc.dids.alice,
    })
    await createReportActivity(db, {
      reportId: report.id,
      activityType: 'reopenActivity',
      createdBy: sc.dids.alice,
    })

    const notifications = await db.db
      .selectFrom('inbox_notification')
      .where('recipientDid', '=', sc.dids.bob)
      .where('sourceKey', 'like', 'report-activity:%')
      .select(['reason', 'target', 'body'])
      .execute()
    expect(notifications.map((n) => n.reason).sort()).toEqual([
      'reportNote',
      'reportReopened',
      'reportResolved',
    ])
    expect(notifications[0].target).toMatchObject({ reportId: report.id })
    expect(notifications.find((n) => n.reason === 'reportNote')?.body).toBe(
      'Reviewed',
    )
    expect(
      await db.db
        .selectFrom('inbox_notification')
        .where('recipientDid', '=', sc.dids.alice)
        .where('section', '=', 'reports')
        .select('id')
        .execute(),
    ).toHaveLength(0)
  })

  it('notifies reporters when a subject is closed in bulk', async () => {
    const event = await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.carol },
      reportedBy: sc.dids.bob,
    })
    await network.processAll()
    const db = network.ozone.ctx.db
    const report = await db.db
      .selectFrom('report')
      .where('eventId', '=', event.id)
      .select('id')
      .executeTakeFirstOrThrow()
    await closeReportsForSubject({
      db,
      subjectDid: sc.dids.carol,
      subjectUri: null,
      isAutomated: false,
      createdBy: sc.dids.alice,
    })
    const rows = await db.db
      .selectFrom('inbox_notification')
      .where('recipientDid', '=', sc.dids.bob)
      .where('reason', '=', 'reportResolved')
      .select('target')
      .execute()
    expect(
      rows.some(
        (row) => 'reportId' in row.target && row.target.reportId === report.id,
      ),
    ).toBe(true)
  })

  it('carries the public appeal resolution note to the subject section', async () => {
    const event = await sc.createReport({
      reasonType: APPEAL_REASON_TYPE,
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      reportedBy: sc.dids.alice,
    })
    await network.processAll()
    const db = network.ozone.ctx.db
    await createReportActivity(db, {
      eventId: event.id,
      activityType: 'closeActivity',
      publicNote: 'Appeal accepted',
      createdBy: sc.dids.bob,
    })
    const row = await db.db
      .selectFrom('inbox_notification')
      .where('recipientDid', '=', sc.dids.alice)
      .where('reason', '=', 'appealResolved')
      .select(['section', 'target', 'body'])
      .executeTakeFirstOrThrow()
    expect(row).toMatchObject({
      section: 'subjects',
      body: 'Appeal accepted',
      target: { subject: { did: sc.dids.alice } },
    })
  })

  it('notifies report authors when a moderation event closes a report', async () => {
    const event = await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.carol },
      reportedBy: sc.dids.bob,
    })
    await network.processAll()
    const db = network.ozone.ctx.db
    const report = await db.db
      .selectFrom('report')
      .where('eventId', '=', event.id)
      .select('id')
      .executeTakeFirstOrThrow()
    await network.ozone.getModClient().emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventComment' },
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.carol },
      reportAction: { ids: [report.id], note: 'We investigated this report' },
    })
    const rows = await db.db
      .selectFrom('inbox_notification')
      .where('recipientDid', '=', sc.dids.bob)
      .where('section', '=', 'reports')
      .select(['reason', 'target', 'body'])
      .execute()
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'reportResolved',
          target: expect.objectContaining({ reportId: report.id }),
        }),
        expect.objectContaining({
          reason: 'reportNote',
          body: 'We investigated this report',
        }),
      ]),
    )
  })

  it('notifies only the moderated account about public actions', async () => {
    const mod = network.ozone.getModClient()
    await mod.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['spam'],
        negateLabelVals: [],
      },
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
    })
    const db = network.ozone.ctx.db
    const row = await db.db
      .selectFrom('inbox_notification')
      .where('recipientDid', '=', sc.dids.alice)
      .where('reason', '=', 'actionTaken')
      .select(['section', 'target'])
      .executeTakeFirstOrThrow()
    expect(row.section).toBe('subjects')
    expect(row.target).toMatchObject({ actionType: 'labelApplied' })
  })

  it('tracks standing changes on account takedown and reversal without strikes', async () => {
    const mod = network.ozone.getModClient()
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef' as const,
      did: sc.dids.carol,
    }
    await mod.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
      subject,
    })
    await mod.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventReverseTakedown' },
      subject,
    })
    const rows = await network.ozone.ctx.db.db
      .selectFrom('inbox_notification')
      .where('recipientDid', '=', sc.dids.carol)
      .where('reason', '=', 'standingChanged')
      .select('target')
      .orderBy('id', 'asc')
      .execute()
    expect(rows.map((row) => row.target)).toMatchObject([
      { standing: 'atRisk', previousStanding: 'good' },
      { standing: 'good', previousStanding: 'atRisk' },
    ])
  })

  it('tracks standing thresholds crossed by strikes on records', async () => {
    const mod = network.ozone.getModClient()
    const did = sc.dids.bob
    for (const [index, strikeCount] of [8, 4].entries()) {
      const post = sc.posts[did][index].ref
      await mod.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTakedown',
          strikeCount,
        },
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.uriStr,
          cid: post.cidStr,
        },
      })
    }
    const strike = await network.ozone.ctx.db.db
      .selectFrom('account_strike')
      .where('did', '=', did)
      .select('activeStrikeCount')
      .executeTakeFirst()
    expect(strike?.activeStrikeCount).toBe(12)
    const rows = await network.ozone.ctx.db.db
      .selectFrom('inbox_notification')
      .where('recipientDid', '=', did)
      .where('reason', '=', 'standingChanged')
      .select('target')
      .orderBy('id', 'asc')
      .execute()
    expect(rows.map((row) => row.target)).toMatchObject([
      { standing: 'warning', previousStanding: 'good' },
      { standing: 'atRisk', previousStanding: 'warning' },
    ])
  })

  it('notifies when expiring strikes improve account standing', async () => {
    const did = sc.dids.carol
    const post = sc.posts[did][0].ref
    await network.ozone.getModClient().emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        strikeCount: 8,
        strikeExpiresAt: new Date(Date.now() + 1_000).toISOString(),
      },
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: post.uriStr,
        cid: post.cidStr,
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 1_100))
    await network.ozone.daemon.ctx.strikeExpiryProcessor.processExpiredStrikes()
    const rows = await network.ozone.ctx.db.db
      .selectFrom('inbox_notification')
      .where('recipientDid', '=', did)
      .where('reason', '=', 'standingChanged')
      .select('target')
      .orderBy('id', 'desc')
      .execute()
    expect(rows[0].target).toMatchObject({
      standing: 'good',
      previousStanding: 'warning',
    })
  })
})
