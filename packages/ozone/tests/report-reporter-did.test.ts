import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { currentDatetimeString } from '@atproto/lex'
import {
  REPORT_REPORTER_DID_BACKFILL_JOB,
  ReportReporterDidBackfiller,
} from '../src/daemon/report-reporter-did-backfiller.js'
import type { Database } from '../src/db/index.js'
import { APPEAL_REASON_TYPE } from '../src/inbox/appeal.js'

describe('report reporter DID backfill', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient
  let db: Database

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_reporter_did',
    })
    await network.ozone.daemon.ctx.reportReporterDidBackfiller.destroy()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    db = network.ozone.ctx.db
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  it('backfills in resumable batches', async () => {
    const userReports = await Promise.all([
      sc.createReport({
        reasonType: 'com.atproto.moderation.defs#reasonSpam',
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
        },
        reportedBy: sc.dids.alice,
      }),
      sc.createReport({
        reasonType: 'com.atproto.moderation.defs#reasonSpam',
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
        },
        reportedBy: sc.dids.carol,
      }),
    ])
    const appealEvent = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReport',
        reportType: APPEAL_REASON_TYPE,
      },
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      },
    })
    const sourceEvents = [...userReports, appealEvent]
    const invalidSourceEvent = await modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.bob,
      },
    })
    await network.processAll()

    const validIds = sourceEvents.map(({ id }) => id)
    const originalReports = await db.db
      .selectFrom('report')
      .select(['id', 'eventId'])
      .where('eventId', 'in', validIds)
      .execute()
    expect(originalReports).toHaveLength(sourceEvents.length)

    const updatedAt = '2026-01-02T03:04:05.000Z'
    await db.db
      .updateTable('report')
      .set({ status: 'closed', updatedAt, reporterDid: null })
      .where('eventId', 'in', validIds)
      .execute()

    const now = currentDatetimeString()
    const baseReport = {
      queueId: -1,
      queuedAt: null,
      actionEventIds: null,
      actionNote: null,
      isMuted: false,
      isAutomated: false,
      status: 'open',
      reportType: 'com.atproto.moderation.defs#reasonSpam',
      did: sc.dids.bob,
      recordPath: '',
      subjectMessageId: null,
      subjectConvoId: null,
      createdAt: now,
      updatedAt: now,
    }
    const missingSourceEventId = 2_000_000_000
    await db.db
      .insertInto('report')
      .values([
        { ...baseReport, eventId: invalidSourceEvent.id },
        { ...baseReport, eventId: missingSourceEventId },
      ])
      .execute()

    await db.db
      .updateTable('job_cursor')
      .set({ cursor: null })
      .where('job', '=', REPORT_REPORTER_DID_BACKFILL_JOB)
      .execute()

    const unfilledReports = await db.db
      .selectFrom('report')
      .select('reporterDid')
      .where('eventId', 'in', [
        ...validIds,
        invalidSourceEvent.id,
        missingSourceEventId,
      ])
      .execute()
    expect(
      unfilledReports.every(({ reporterDid }) => reporterDid === null),
    ).toBe(true)

    const firstWorker = new ReportReporterDidBackfiller(db, 2)
    const competingWorker = new ReportReporterDidBackfiller(db, 2)
    await firstWorker.initializeCursor()
    await competingWorker.initializeCursor()
    const [firstBatch, competingBatch] = await Promise.all([
      firstWorker.processBatch(),
      competingWorker.processBatch(),
    ])
    expect(firstBatch.scannedRows).toBe(2)
    expect(competingBatch.scannedRows).toBe(2)
    expect(firstBatch.lastId).not.toBe(competingBatch.lastId)

    // A fresh worker resumes from the committed cursors left by both workers.
    const resumedWorker = new ReportReporterDidBackfiller(db, 2)
    const remaining = await resumedWorker.processAll()
    expect(
      firstBatch.updatedRows +
        competingBatch.updatedRows +
        remaining.updatedRows,
    ).toBe(sourceEvents.length)
    expect(
      firstBatch.missingSourceRows +
        competingBatch.missingSourceRows +
        remaining.missingSourceRows,
    ).toBe(1)
    expect(
      firstBatch.invalidSourceRows +
        competingBatch.invalidSourceRows +
        remaining.invalidSourceRows,
    ).toBe(1)
    expect(
      firstBatch.scannedRows +
        competingBatch.scannedRows +
        remaining.scannedRows,
    ).toBe(sourceEvents.length + 2)

    const authors = await db.db
      .selectFrom('moderation_event')
      .select(['id', 'createdBy'])
      .where('id', 'in', validIds)
      .execute()
    const reports = await db.db
      .selectFrom('report')
      .select(['eventId', 'reporterDid', 'status', 'updatedAt'])
      .where('eventId', 'in', [
        ...validIds,
        invalidSourceEvent.id,
        missingSourceEventId,
      ])
      .execute()
    const authorByEventId = new Map(
      authors.map(({ id, createdBy }) => [id, createdBy]),
    )

    for (const report of reports) {
      if (authorByEventId.has(report.eventId)) {
        expect(report.reporterDid).toBe(authorByEventId.get(report.eventId))
        expect(report.status).toBe('closed')
        expect(report.updatedAt).toBe(updatedAt)
      } else {
        expect(report.reporterDid).toBeNull()
      }
    }
    expect(reports).toHaveLength(sourceEvents.length + 2)
  })
})
