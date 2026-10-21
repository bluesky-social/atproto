import { ComAtprotoModerationDefs } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { type DidString, toDatetimeString } from '@atproto/lex'
import { parseStrikeSuspensionConfig } from '../src/config/strike-suspension.js'
import { APPEAL_REASON_TYPE } from '../src/inbox/appeal.js'
import { RepoSubject } from '../src/mod-service/subject.js'
import {
  inboxHeaders,
  reportForEvent,
  withNotificationInsertFailure,
} from './_inbox.js'

describe('inbox notification producers', () => {
  let network: TestNetwork
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_inbox_notification_producers_review',
    })
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    Object.assign(
      network.ozone.ctx.cfg.strikeSuspension,
      parseStrikeSuspensionConfig('4:72,8:168,12:336,16:Infinity'),
    )
  })
  afterAll(async () => network?.close())

  function repo(did: DidString) {
    return { $type: 'com.atproto.admin.defs#repoRef' as const, did }
  }

  async function notifications(did: DidString, reasons?: string[]) {
    const { data } = await sc.agent.tools.ozone.inbox.listNotifications(
      { reasons },
      { headers: inboxHeaders(network, sc, did) },
    )
    return data.notifications
  }

  async function createReport(
    subjectDid: DidString,
    reportedBy: DidString,
    reasonType = ComAtprotoModerationDefs.REASONSPAM,
  ) {
    const event = await sc.createReport({
      reasonType,
      subject: repo(subjectDid),
      reportedBy,
    })
    await network.processAll()
    return reportForEvent(network.ozone.getModClient(), event.id)
  }

  async function activity(
    reportId: number,
    activityType: 'closeActivity' | 'reopenActivity' | 'noteActivity',
    publicNote?: string,
  ) {
    const method = 'tools.ozone.report.createActivity'
    return network.ozone.getAgent().tools.ozone.report.createActivity(
      {
        reportId,
        activity: { $type: `tools.ozone.report.defs#${activityType}` },
        publicNote,
        internalNote: 'Moderator-only context',
      },
      { headers: await network.ozone.modHeaders(method) },
    )
  }

  it('notifies the reporter about transitions and excludes all moderator note text', async () => {
    const report = await createReport(sc.dids.alice, sc.dids.bob)
    await activity(report.id, 'closeActivity', 'Reviewed')
    await activity(report.id, 'reopenActivity')
    await activity(report.id, 'noteActivity', 'Public text must stay private')
    const rows = (await notifications(sc.dids.bob)).filter(
      (row) => 'reportId' in row.target && row.target.reportId === report.id,
    )
    expect(rows.map((row) => row.reason).sort()).toEqual([
      'reportReopened',
      'reportResolved',
    ])
    expect(JSON.stringify(rows)).not.toMatch(
      /Reviewed|Moderator-only|Public text/,
    )
    expect(rows.every((row) => !('body' in row))).toBe(true)
    expect(
      await notifications(sc.dids.alice, ['reportResolved', 'reportReopened']),
    ).toHaveLength(0)
  })

  it('notifies reporters when a subject is closed in bulk', async () => {
    const reports = await Promise.all([
      createReport(sc.dids.carol, sc.dids.bob),
      createReport(sc.dids.carol, sc.dids.dan),
    ])
    const { data } = await network.ozone
      .getAgent()
      .tools.ozone.report.closeReports(
        { subject: sc.dids.carol },
        {
          headers: await network.ozone.modHeaders(
            'tools.ozone.report.closeReports',
          ),
        },
      )
    expect(data.reportIds).toEqual(
      expect.arrayContaining(reports.map((report) => report.id)),
    )
    for (const [index, did] of [sc.dids.bob, sc.dids.dan].entries()) {
      expect(await notifications(did, ['reportResolved'])).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: expect.objectContaining({ reportId: reports[index].id }),
          }),
        ]),
      )
    }
  })

  it('notifies appeal resolution in the subject section without note text', async () => {
    const report = await createReport(
      sc.dids.alice,
      sc.dids.alice,
      APPEAL_REASON_TYPE,
    )
    await activity(report.id, 'closeActivity', 'Appeal accepted')
    expect(await notifications(sc.dids.alice, ['appealResolved'])).toEqual([
      expect.objectContaining({
        target: expect.objectContaining({
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.alice,
          },
        }),
      }),
    ])
    expect(
      JSON.stringify(await notifications(sc.dids.alice, ['appealResolved'])),
    ).not.toContain('Appeal accepted')
  })

  it('notifies report authors when an event closes a report', async () => {
    const report = await createReport(sc.dids.carol, sc.dids.bob)
    await network.ozone.getModClient().emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventComment' },
      subject: repo(sc.dids.carol),
      reportAction: { ids: [report.id], note: 'We investigated this report' },
    })
    expect(await notifications(sc.dids.bob, ['reportResolved'])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: expect.objectContaining({ reportId: report.id }),
        }),
      ]),
    )
    expect(JSON.stringify(await notifications(sc.dids.bob))).not.toContain(
      'We investigated this report',
    )
  })

  it('notifies only the moderated account about actions and label reversals', async () => {
    const mod = network.ozone.getModClient()
    const event = await mod.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['spam'],
        negateLabelVals: [],
      },
      subject: repo(sc.dids.alice),
    })
    const reversal = await mod.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: [],
        negateLabelVals: ['spam'],
      },
      subject: repo(sc.dids.alice),
    })
    expect(
      await notifications(sc.dids.alice, ['actionTaken', 'actionReversed']),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'actionTaken',
          target: expect.objectContaining({
            actionId: event.id,
            actionType: 'labelApplied',
          }),
        }),
        expect.objectContaining({
          reason: 'actionReversed',
          target: expect.objectContaining({
            actionId: reversal.id,
            actionType: 'labelRemoved',
          }),
        }),
      ]),
    )
    expect(
      (await notifications(sc.dids.bob)).some(
        (row) => 'actionId' in row.target && row.target.actionId === event.id,
      ),
    ).toBe(false)
  })

  it('tracks standing on account takedown and reversal without strikes', async () => {
    const mod = network.ozone.getModClient()
    await mod.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
      subject: repo(sc.dids.carol),
    })
    await mod.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventReverseTakedown' },
      subject: repo(sc.dids.carol),
    })
    expect(
      (await notifications(sc.dids.carol, ['standingChanged']))
        .map((row) => row.target)
        .reverse(),
    ).toMatchObject([
      { standing: 'atRisk', previousStanding: 'good' },
      { standing: 'good', previousStanding: 'atRisk' },
    ])
  })

  it('uses the second and third configured strike thresholds and agrees with account status', async () => {
    const did = sc.dids.bob
    await sc.post(did, 'Third strike fixture')
    await network.processAll()
    for (const [index, strikeCount] of [4, 4, 4].entries()) {
      const post = sc.posts[did][index].ref
      await network.ozone.getModClient().emitEvent({
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
      const { data } = await sc.agent.tools.ozone.inbox.getAccountStatus(
        {},
        { headers: inboxHeaders(network, sc, did) },
      )
      expect(data.standing).toBe(['good', 'warning', 'atRisk'][index])
    }
    expect(
      (await notifications(did, ['standingChanged']))
        .map((row) => row.target)
        .reverse(),
    ).toMatchObject([
      { standing: 'warning', previousStanding: 'good' },
      { standing: 'atRisk', previousStanding: 'warning' },
    ])
  })

  it('notifies when expiring strikes improve standing', async () => {
    const did = sc.dids.carol
    const post = sc.posts[did][0].ref
    await network.ozone.getModClient().emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        strikeCount: 8,
        strikeExpiresAt: toDatetimeString(Date.now() + 1000),
      },
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: post.uriStr,
        cid: post.cidStr,
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 1100))
    await network.ozone.daemon.ctx.strikeExpiryProcessor.processExpiredStrikes()
    expect(
      (await notifications(did, ['standingChanged']))[0].target,
    ).toMatchObject({ standing: 'good', previousStanding: 'warning' })
  })

  it('notifies about automatic reversals through the common moderation service', async () => {
    const subject = repo(sc.dids.dan)
    await network.ozone.getModClient().emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        durationInHours: 1,
      },
      subject,
    })
    // @NOTE Daemon execution has no public endpoint. The reversal itself uses the common service.
    await network.ozone.daemon.ctx.eventReverser.revertState({
      subject: new RepoSubject(sc.dids.dan),
      reverseSuspend: true,
      reverseMute: false,
    })
    expect(await notifications(sc.dids.dan, ['actionReversed'])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: expect.objectContaining({ actionType: 'accountRestored' }),
        }),
      ]),
    )
  })

  it('serializes concurrent record strikes into one standing transition', async () => {
    const did = sc.dids.dan
    await Promise.all(
      sc.posts[did].slice(0, 2).map(({ ref }) =>
        network.ozone.getModClient().emitEvent({
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTakedown',
            strikeCount: 4,
          },
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: ref.uriStr,
            cid: ref.cidStr,
          },
        }),
      ),
    )
    const rows = (await notifications(did, ['standingChanged'])).filter(
      (row) => 'standing' in row.target && row.target.standing === 'warning',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].target).toMatchObject({
      standing: 'warning',
      previousStanding: 'good',
    })
    const { data } = await sc.agent.tools.ozone.inbox.getAccountStatus(
      {},
      { headers: inboxHeaders(network, sc, did) },
    )
    expect(data.standing).toBe('warning')
  })

  it('commits moderation events even when notification SQL fails', async () => {
    await withNotificationInsertFailure(network.ozone.ctx.db, async () => {
      const event = await network.ozone.getModClient().emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals: ['spam'],
          negateLabelVals: [],
        },
        subject: repo(sc.dids.dan),
      })
      const { events } = await network.ozone
        .getModClient()
        .queryEvents({ subject: sc.dids.dan })
      expect(events.some((row) => row.id === event.id)).toBe(true)
      expect(
        (await notifications(sc.dids.dan)).some(
          (row) => 'actionId' in row.target && row.target.actionId === event.id,
        ),
      ).toBe(false)
    })
  })

  it('commits report closure even when notification SQL fails', async () => {
    const report = await createReport(sc.dids.dan, sc.dids.bob)
    await withNotificationInsertFailure(network.ozone.ctx.db, async () => {
      await activity(report.id, 'closeActivity')
      expect(
        (await reportForEvent(network.ozone.getModClient(), report.eventId))
          .status,
      ).toBe('closed')
    })
  })
})
