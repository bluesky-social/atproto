import { type Kysely, sql } from 'kysely'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { currentDatetimeString } from '@atproto/lex'
import type { Database } from '../src/db/index.js'
import {
  down,
  up,
} from '../src/db/migrations/20261002T000000000Z-add-report-reporter-did.js'
import { APPEAL_REASON_TYPE } from '../src/inbox/appeal.js'

describe('report reporter DID migration', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient
  let db: Database

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_reporter_did',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    db = network.ozone.ctx.db
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  it('backfills only valid source authors and rolls back with its transaction', async () => {
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
      .set({ status: 'closed', updatedAt })
      .where('eventId', 'in', validIds)
      .execute()

    await db.transaction(async (tx) =>
      down(tx.db as unknown as Kysely<unknown>),
    )

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

    await expect(
      db.transaction(async (tx) => {
        await up(tx.db as unknown as Kysely<unknown>)
        throw new Error('rollback backfill')
      }),
    ).rejects.toThrow('rollback backfill')
    const rolledBackColumn = await sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'report'
          AND column_name = 'reporterDid'
      ) AS exists
    `.execute(db.db)
    expect(rolledBackColumn.rows[0]?.exists).toBe(false)

    await db.transaction(async (tx) => up(tx.db as unknown as Kysely<unknown>))

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
