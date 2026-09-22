import { jest } from '@jest/globals'
import { sql } from 'kysely'
import { ids } from '@atproto/api'
import type AtpAgent from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { currentDatetimeString, toDatetimeString } from '@atproto/lex'
import type { DatetimeString, DidString } from '@atproto/lex'
import type { DateString } from '../src/db/schema/report_stat.js'
import { com, tools } from '../src/lexicons/index.js'
import { REPORT_TYPE_GROUPS, ReportStatsService } from '../src/report/stats.js'

describe('report-stats', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient
  let spamQueueId: number
  let threatQueueId: number

  const createQueue = async (input: {
    name: string
    subjectTypes: string[]
    reportTypes: string[]
    collection?: string
  }) => {
    const { data } = await agent.tools.ozone.queue.createQueue(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneQueueCreateQueue,
        'admin',
      ),
    })
    return data.queue
  }

  const getLiveStats = async (params?: {
    queueId?: number
    moderatorDid?: string
    reportTypes?: string[]
  }) => {
    const { data } = await agent.tools.ozone.report.getLiveStats(params, {
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportGetLiveStats,
        'admin',
      ),
    })
    return data.stats
  }

  const getHistoricalStats = async (params?: {
    queueId?: number
    moderatorDid?: string
    reportTypes?: string[]
    startDate?: string
    endDate?: string
    limit?: number
    cursor?: string
  }) => {
    const { data } = await agent.tools.ozone.report.getHistoricalStats(params, {
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportGetHistoricalStats,
        'admin',
      ),
    })
    return data
  }

  const refreshStats = async (
    input: tools.ozone.report.refreshStats.$InputBody,
  ) => {
    await agent.tools.ozone.report.refreshStats(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportRefreshStats,
        'admin',
      ),
    })
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_stats',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()

    // seed queues
    const spamQueue = await createQueue({
      name: 'Stats: Spam Accounts',
      subjectTypes: ['account'],
      reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
    })
    const threatQueue = await createQueue({
      name: 'Stats: Threat Accounts',
      subjectTypes: ['account'],
      reportTypes: ['tools.ozone.report.defs#reasonViolenceThreats'],
    })
    spamQueueId = spamQueue.id
    threatQueueId = threatQueue.id

    // seed reports
    await sc.createReport({
      reasonType: 'com.atproto.moderation.defs#reasonSpam',
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice as DidString,
      },
      reportedBy: sc.dids.bob,
    })
    await sc.createReport({
      reasonType: 'com.atproto.moderation.defs#reasonSpam',
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.bob as DidString,
      },
      reportedBy: sc.dids.alice,
    })
    await sc.createReport({
      reasonType: 'tools.ozone.report.defs#reasonViolenceThreats',
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.carol as DidString,
      },
      reportedBy: sc.dids.alice,
    })
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    await modClient.computeStats()
  })

  afterAll(async () => {
    await network?.close()
  })

  describe('aggregate', () => {
    it('returns aggregate stats when no params provided', async () => {
      const stats = await getLiveStats()
      expect(stats.inboundCount).toBeGreaterThanOrEqual(3)
      expect(stats.lastUpdated).toBeDefined()
    })

    it('includes unqueued reports in aggregate', async () => {
      await sc.createReport({
        reasonType: 'com.atproto.moderation.defs#reasonMisleading',
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.carol as DidString,
        },
        reportedBy: sc.dids.bob,
      })
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      await modClient.computeStats()
      const stats = await getLiveStats()
      expect(stats.pendingCount).toBeGreaterThanOrEqual(1)
    })

    it('pendingCount includes reports created before the time window', async () => {
      const db = network.ozone.ctx.db

      await sc.createReport({
        reasonType: 'com.atproto.moderation.defs#reasonSpam',
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.alice as DidString,
        },
        reportedBy: sc.dids.carol,
      })
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const oldDate = new Date(
        Date.now() - 3 * 24 * 60 * 60 * 1000,
      ).toISOString()
      const report = await db.db
        .selectFrom('report')
        .select(['id'])
        .where('status', '!=', 'closed')
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()
      await db.db
        .updateTable('report')
        .set({
          createdAt: oldDate as DatetimeString,
          updatedAt: oldDate as DatetimeString,
        })
        .where('id', '=', report.id)
        .execute()

      await modClient.computeStats()
      const aggregateStats = await getLiveStats()
      const queueStats = await getLiveStats({ queueId: spamQueueId })

      expect(aggregateStats.pendingCount).toBeGreaterThanOrEqual(1)
      expect(queueStats.pendingCount).toBeGreaterThanOrEqual(1)
    })

    it('omitting reportTypes returns aggregate across all types', async () => {
      await modClient.computeStats()

      // No params = aggregate; reportTypes omitted should yield same result
      const stats = await getLiveStats()
      expect(stats.inboundCount).toBeGreaterThanOrEqual(3)
      expect(stats.pendingCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('queue', () => {
    it('returns per-queue stats for spam queue', async () => {
      const stats = await getLiveStats({ queueId: spamQueueId })
      expect(stats.pendingCount).toBeGreaterThanOrEqual(2)
      expect(stats.inboundCount).toBeGreaterThanOrEqual(2)
    })

    it('returns per-queue stats for threat queue', async () => {
      const stats = await getLiveStats({ queueId: threatQueueId })
      expect(stats.pendingCount).toBeGreaterThanOrEqual(1)
    })

    it('reflects status changes after recompute', async () => {
      const stats1 = await getLiveStats({ queueId: spamQueueId })

      await sc.createReport({
        reasonType: 'com.atproto.moderation.defs#reasonSpam',
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.carol as DidString,
        },
        reportedBy: sc.dids.bob,
      })
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      await modClient.computeStats()
      const stats2 = await getLiveStats({ queueId: spamQueueId })

      expect(stats2.pendingCount! - stats1.pendingCount!).toBe(1)
      expect(stats2.inboundCount! - stats1.inboundCount!).toBe(1)
    })

    it('returns zeroed stats for empty queue', async () => {
      const emptyQueue = await createQueue({
        name: 'Stats: Empty Queue',
        subjectTypes: ['record'],
        reportTypes: ['com.atproto.moderation.defs#reasonOther'],
      })
      await modClient.computeStats()
      const stats = await getLiveStats({ queueId: emptyQueue.id })

      expect(stats.pendingCount).toBe(0)
      expect(stats.inboundCount).toBe(0)
      expect(stats.avgHandlingTimeSec).toBeUndefined()
      expect(stats.avgResolutionTimeSec).toBeUndefined()
    })

    it('computes stats for unqueued reports (queueId = -1)', async () => {
      const db = network.ozone.ctx.db

      const unqueuedBefore = await db.db
        .selectFrom('report')
        .select(sql<number>`count(*)`.as('count'))
        .where('queueId', '=', -1)
        .where('status', '!=', 'closed')
        .executeTakeFirstOrThrow()

      await sc.createReport({
        reasonType: 'com.atproto.moderation.defs#reasonMisleading',
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.alice as DidString,
        },
        reportedBy: sc.dids.carol,
      })
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      await modClient.computeStats()

      const unqueuedAfter = await db.db
        .selectFrom('report')
        .select(sql<number>`count(*)`.as('count'))
        .where('queueId', '=', -1)
        .where('status', '!=', 'closed')
        .executeTakeFirstOrThrow()
      expect(Number(unqueuedAfter.count)).toBe(Number(unqueuedBefore.count) + 1)

      const stats = await getLiveStats({ queueId: -1 })
      expect(stats.pendingCount).toBe(Number(unqueuedAfter.count))
      expect(stats.inboundCount).toBeGreaterThanOrEqual(1)
      expect(stats.lastUpdated).toBeDefined()
    })

    it('unqueued stats are separate from aggregate stats', async () => {
      await modClient.computeStats()

      const aggregateStats = await getLiveStats()
      const unqueuedStats = await getLiveStats({ queueId: -1 })

      expect(aggregateStats.pendingCount).toBeGreaterThanOrEqual(
        unqueuedStats.pendingCount ?? 0,
      )
    })
  })

  describe('moderator', () => {
    it('returns per-moderator stats after action', async () => {
      const moderatorDid = network.ozone.moderatorAccnt.did
      const db = network.ozone.ctx.db

      // Create reports, assign a moderator, backdate creation, then close.
      const ages = [30, 60, 90]
      for (const ts of ages) {
        await sc.createReport({
          reasonType: 'com.atproto.moderation.defs#reasonOther',
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.carol as DidString,
          },
          reportedBy: sc.dids.bob,
        })
        // Report rows are inserted asynchronously by the queue-router daemon —
        // drain it before looking up the row.
        await network.processAll()
        const backdate = toDatetimeString(Date.now() - ts * 1000)
        const report = await db.db
          .selectFrom('report')
          .select(['id', 'status'])
          .orderBy('id', 'desc')
          .executeTakeFirstOrThrow()
        await db.db
          .updateTable('report')
          .set({
            status: 'open',
            createdAt: backdate,
            updatedAt: backdate,
            assignedTo: moderatorDid,
            assignedAt: backdate,
          })
          .where('id', '=', report.id)
          .execute()
        await modClient.emitEvent(
          {
            event: {
              $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
            },
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.carol as DidString,
            },
            reportAction: { ids: [report.id] },
          },
          'moderator',
        )
      }

      await modClient.computeStats()
      const stats = await getLiveStats({ moderatorDid })
      const avgHandlingTime = ages.reduce((a, b) => a + b, 0) / ages.length
      expect(stats.avgHandlingTimeSec).toBeDefined()
      expect(stats.avgHandlingTimeSec).toBeGreaterThanOrEqual(
        avgHandlingTime - 5,
      )
      expect(stats.avgHandlingTimeSec).toBeLessThanOrEqual(avgHandlingTime + 5)
    })

    it('returns zeroed per-moderator stats for inactive moderator', async () => {
      const triageDid = network.ozone.triageAccnt.did
      await modClient.computeStats()
      const stats = await getLiveStats({ moderatorDid: triageDid })

      expect(stats.actionedCount).toBe(0)
      expect(stats.inboundCount).toBe(0)
      expect(stats.escalatedCount).toBe(0)
      expect(stats.pendingCount).toBeUndefined()
    })
  })

  describe('report type group', () => {
    it('computes per-group stats for Legacy group', async () => {
      await modClient.computeStats()

      const legacyStats = await getLiveStats({
        reportTypes: REPORT_TYPE_GROUPS.Legacy,
      })
      const allStats = await getLiveStats()

      // Legacy group includes spam, etc. seeded above
      expect(legacyStats.inboundCount).toBeGreaterThanOrEqual(2)

      // Aggregate should be >= legacy group
      expect(allStats.inboundCount).toBeGreaterThanOrEqual(
        legacyStats.inboundCount!,
      )
    })

    it('only counts matching report types within group', async () => {
      await modClient.computeStats()

      const legacyStats = await getLiveStats({
        reportTypes: REPORT_TYPE_GROUPS.Legacy,
      })
      const violenceStats = await getLiveStats({
        reportTypes: REPORT_TYPE_GROUPS.Violence,
      })

      // Legacy group should include spam + misleading
      expect(legacyStats.inboundCount).toBeGreaterThanOrEqual(2)
      expect(legacyStats.pendingCount).toBeGreaterThanOrEqual(0)
      // Violence group should only include threats
      expect(violenceStats.inboundCount).toBeGreaterThanOrEqual(1)
      expect(violenceStats.pendingCount).toBeGreaterThanOrEqual(1)
    })

    it('tracks escalated counts within group', async () => {
      const db = network.ozone.ctx.db

      await sc.createReport({
        reasonType: 'com.atproto.moderation.defs#reasonSpam',
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob as DidString,
        },
        reportedBy: sc.dids.carol,
      })
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await db.db
        .selectFrom('report')
        .select(['id'])
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()

      await db.db
        .updateTable('report')
        .set({ status: 'open', updatedAt: currentDatetimeString() })
        .where('id', '=', report.id)
        .execute()

      await modClient.emitEvent(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#modEventEscalate',
          },
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
          reportAction: { ids: [report.id] },
        },
        'moderator',
      )

      await modClient.computeStats()

      const stats = await getLiveStats({
        reportTypes: REPORT_TYPE_GROUPS.Legacy,
      })
      expect(stats.escalatedCount).toBeGreaterThanOrEqual(1)
    })

    it('returns zeroed stats for unused report type group', async () => {
      await modClient.computeStats()

      // Civic group has no seeded reports: all counts should be 0
      const stats = await getLiveStats({
        reportTypes: REPORT_TYPE_GROUPS.Civic,
      })
      expect(stats.inboundCount).toBe(0)
      expect(stats.pendingCount).toBe(0)
    })

    it('calculates handling and resolution time for the current close', async () => {
      const db = network.ozone.ctx.db

      await sc.createReport({
        reasonType: 'tools.ozone.report.defs#reasonSexualUnlabeled',
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.alice as DidString,
        },
        reportedBy: sc.dids.carol,
      })
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await db.db
        .selectFrom('report')
        .select(['id'])
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()

      const backdate = toDatetimeString(Date.now() - 120 * 1000)
      const assignedAt = toDatetimeString(Date.now() - 60 * 1000)
      await db.db
        .updateTable('report')
        .set({
          createdAt: backdate,
          assignedAt,
          updatedAt: assignedAt,
        })
        .where('id', '=', report.id)
        .execute()

      await modClient.emitEvent(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
          },
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.alice,
          },
          reportAction: { ids: [report.id] },
        },
        'moderator',
      )

      await modClient.computeStats()

      const stats = await getLiveStats({
        reportTypes: REPORT_TYPE_GROUPS.Sexual,
      })
      expect(stats.closedCount).toBeGreaterThanOrEqual(1)
      expect(stats.acknowledgedCount).toBeGreaterThanOrEqual(1)
      expect(stats.avgHandlingTimeSec).toBeGreaterThanOrEqual(55)
      expect(stats.avgHandlingTimeSec).toBeLessThan(115)
      expect(stats.avgResolutionTimeSec).toBeGreaterThanOrEqual(115)

      await db.db
        .updateTable('report')
        .set({
          status: 'open',
          closedAt: null,
          updatedAt: currentDatetimeString(),
        })
        .where('id', '=', report.id)
        .execute()
      await modClient.computeStats()
      const reopened = await getLiveStats({
        reportTypes: REPORT_TYPE_GROUPS.Sexual,
      })
      expect(reopened.closedCount).toBe(0)
      expect(reopened.ahtSampleCount).toBe(0)
      expect(reopened.resolutionSampleCount).toBe(0)

      const reclosedAt = currentDatetimeString()
      await db.db
        .updateTable('report')
        .set({
          status: 'closed',
          closedAt: reclosedAt,
          updatedAt: reclosedAt,
        })
        .where('id', '=', report.id)
        .execute()
      await modClient.computeStats()
      const reclosed = await getLiveStats({
        reportTypes: REPORT_TYPE_GROUPS.Sexual,
      })
      expect(reclosed.closedCount).toBe(1)
      expect(reclosed.ahtSampleCount).toBe(1)
      expect(reclosed.resolutionSampleCount).toBe(1)
      expect(reclosed.avgHandlingTimeSec).toBeGreaterThanOrEqual(55)
      expect(reclosed.avgHandlingTimeSec).toBeLessThan(115)
      expect(reclosed.avgResolutionTimeSec).toBeGreaterThanOrEqual(115)
    })

    it('classifies label and takedown closures as actioned', async () => {
      const db = network.ozone.ctx.db
      const before = await getLiveStats()

      const cases = [
        {
          did: sc.dids.bob,
          event: {
            $type: 'tools.ozone.moderation.defs#modEventLabel' as const,
            createLabelVals: ['spam'],
            negateLabelVals: [],
          },
        },
        {
          did: sc.dids.carol,
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTakedown' as const,
          },
        },
      ]

      const reportIds: number[] = []
      for (const action of cases) {
        await sc.createReport({
          reasonType: 'com.atproto.moderation.defs#reasonOther',
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: action.did,
          },
          reportedBy: sc.dids.alice,
        })
        await network.processAll()
        const report = await db.db
          .selectFrom('report')
          .select('id')
          .orderBy('id', 'desc')
          .executeTakeFirstOrThrow()
        reportIds.push(report.id)

        await modClient.emitEvent(
          {
            event: action.event,
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: action.did,
            },
            reportAction: { ids: [report.id] },
          },
          'moderator',
        )
      }

      const reports = await db.db
        .selectFrom('report')
        .select(['id', 'actionEventIds'])
        .where('id', 'in', reportIds)
        .execute()
      expect(reports).toHaveLength(2)
      expect(reports.every((row) => row.actionEventIds?.length === 1)).toBe(
        true,
      )

      await modClient.computeStats()
      const after = await getLiveStats()
      expect(after.closedCount! - before.closedCount!).toBe(2)
      expect(after.actionedCount! - before.actionedCount!).toBe(2)
      expect(after.acknowledgedCount! - before.acknowledgedCount!).toBe(0)
      expect(after.labelActionCount! - before.labelActionCount!).toBe(1)
      expect(after.takedownActionCount! - before.takedownActionCount!).toBe(1)
    })
  })

  describe('group aggregation', () => {
    const createReport = async (
      assignedTo?: DidString,
      createdAt = currentDatetimeString(),
    ) => {
      const event = await sc.createReport({
        reasonType: com.atproto.moderation.defs.ReasonOther,
        subject: {
          $type: com.atproto.admin.defs.repoRef.$type,
          did: sc.dids.alice,
        },
        reportedBy: sc.dids.bob,
      })
      await network.processAll()
      return network.ozone.ctx.db.db
        .updateTable('report')
        .set({
          status: assignedTo ? 'assigned' : 'open',
          assignedTo: assignedTo ?? null,
          assignedAt: assignedTo ? createdAt : null,
          createdAt,
        })
        .where('eventId', '=', event.id)
        .returning('id')
        .executeTakeFirstOrThrow()
    }

    it('preserves aggregate lifecycle totals alongside moderator totals', async () => {
      const moderatorDid = network.ozone.moderatorAccnt.did
      await modClient.computeStats()
      const before = await getLiveStats()
      const moderatorBefore = await getLiveStats({ moderatorDid })

      for (const assignedTo of [moderatorDid, undefined]) {
        const report = await createReport(assignedTo)
        for (const event of [
          { $type: tools.ozone.moderation.defs.modEventEscalate.$type },
          { $type: tools.ozone.moderation.defs.modEventAcknowledge.$type },
        ]) {
          await modClient.emitEvent(
            {
              event,
              subject: {
                $type: com.atproto.admin.defs.repoRef.$type,
                did: sc.dids.alice,
              },
              reportAction: { ids: [report.id] },
            },
            'moderator',
          )
        }
      }

      await modClient.computeStats()
      const after = await getLiveStats()
      const moderatorAfter = await getLiveStats({ moderatorDid })

      for (const metric of [
        'inboundCount',
        'closedCount',
        'acknowledgedCount',
        'escalatedCount',
        'resolutionSampleCount',
      ] as const) {
        expect(after[metric]! - before[metric]!).toBe(2)
        expect(moderatorAfter[metric]! - moderatorBefore[metric]!).toBe(1)
      }
      expect(after.ahtSampleCount! - before.ahtSampleCount!).toBe(1)
      expect(moderatorAfter.pendingCount).toBeUndefined()
    })

    it('counts moderator inbound reports without lifecycle activity only in their creation day', async () => {
      const moderatorDid = network.ozone.triageAccnt.did
      await modClient.computeStats()
      const before = await getLiveStats({ moderatorDid })

      await createReport(moderatorDid)
      await createReport(
        moderatorDid,
        toDatetimeString(Date.now() - 24 * 60 * 60 * 1000),
      )
      await modClient.computeStats()

      const after = await getLiveStats({ moderatorDid })
      expect(after.inboundCount! - before.inboundCount!).toBe(1)
      expect(after.closedCount).toBe(before.closedCount)
      expect(after.escalatedCount).toBe(before.escalatedCount)
      expect(after.pendingCount).toBeUndefined()
    })

    it('combines null and unmatched queue IDs across all metrics', async () => {
      const moderatorDid = network.ozone.moderatorAccnt.did
      await modClient.computeStats()
      const before = await getLiveStats({ queueId: -1 })
      const aggregateBefore = await getLiveStats()
      const reports = [
        await createReport(moderatorDid),
        await createReport(moderatorDid),
      ]
      await network.ozone.ctx.db.db
        .updateTable('report')
        .set({ queueId: null })
        .where('id', '=', reports[0].id)
        .execute()
      await network.ozone.ctx.db.db
        .updateTable('report')
        .set({ queueId: -1 })
        .where('id', '=', reports[1].id)
        .execute()

      await modClient.computeStats()
      const pending = await getLiveStats({ queueId: -1 })
      expect(pending.inboundCount! - before.inboundCount!).toBe(2)
      expect(pending.pendingCount! - before.pendingCount!).toBe(2)

      for (const report of reports) {
        for (const event of [
          { $type: tools.ozone.moderation.defs.modEventEscalate.$type },
          { $type: tools.ozone.moderation.defs.modEventAcknowledge.$type },
        ]) {
          await modClient.emitEvent(
            {
              event,
              subject: {
                $type: com.atproto.admin.defs.repoRef.$type,
                did: sc.dids.alice,
              },
              reportAction: { ids: [report.id] },
            },
            'moderator',
          )
        }
      }

      await modClient.computeStats()
      const after = await getLiveStats({ queueId: -1 })
      const aggregateAfter = await getLiveStats()
      for (const metric of [
        'inboundCount',
        'closedCount',
        'acknowledgedCount',
        'escalatedCount',
        'ahtSampleCount',
        'resolutionSampleCount',
      ] as const) {
        expect(after[metric]! - before[metric]!).toBe(2)
        expect(aggregateAfter[metric]! - aggregateBefore[metric]!).toBe(2)
      }
      expect(after.pendingCount).toBe(before.pendingCount)
    })
  })

  describe('refresh stats', () => {
    const firstDate = '2001-01-01'
    const secondDate = '2001-01-02'
    const beforeWindow = '2000-12-31T12:00:00.000Z'
    const lastMillisecond = '2001-01-01T23:59:59.999Z'
    const cutoff = '2001-01-02T00:00:00.000Z'
    const nextCutoff = '2001-01-03T00:00:00.000Z'

    it.each([
      ...['open', 'queued', 'assigned', 'escalated'].map((status) => ({
        name: `old ${status} report`,
        status,
        createdAt: beforeWindow,
        transitions: [] as string[],
        expected: [1, 1],
      })),
      {
        name: 'created exactly at midnight',
        createdAt: cutoff,
        transitions: [],
        expected: [0, 1],
      },
      {
        name: 'created in the last millisecond',
        createdAt: lastMillisecond,
        transitions: [],
        expected: [1, 1],
      },
      {
        name: 'closed in the last millisecond',
        transitions: [lastMillisecond],
        expected: [0, 0],
      },
      {
        name: 'closed exactly at midnight',
        transitions: [cutoff],
        expected: [1, 0],
      },
      {
        name: 'closed after both days',
        transitions: [nextCutoff],
        expected: [1, 1],
      },
      {
        name: 'closure timestamp without activity history',
        transitions: [cutoff],
        skipHistory: true,
        expected: [1, 0],
      },
      {
        name: 'reopened exactly at midnight',
        transitions: [beforeWindow, cutoff],
        expected: [0, 1],
      },
      {
        name: 'reopened before midnight',
        transitions: [beforeWindow, lastMillisecond],
        expected: [1, 1],
      },
      {
        name: 'closed, reopened, and closed again',
        transitions: [beforeWindow, cutoff, nextCutoff],
        expected: [0, 1],
      },
      {
        name: 'closed after the first day and later reopened',
        transitions: [cutoff, nextCutoff],
        expected: [1, 0],
      },
      {
        name: 'close and reopen share a timestamp',
        transitions: [cutoff, cutoff],
        expected: [1, 1],
      },
      {
        name: 'reopen and close share a timestamp',
        transitions: [beforeWindow, cutoff, cutoff],
        expected: [0, 0],
      },
    ])('reconstructs end-of-day backlog: $name', async (fixture) => {
      const db = network.ozone.ctx.db.db
      await sc.createReport({
        reasonType: com.atproto.moderation.defs.ReasonSpam,
        subject: {
          $type: com.atproto.admin.defs.repoRef.$type,
          did: sc.dids.alice as DidString,
        },
        reportedBy: sc.dids.bob,
      })
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      const report = await db
        .selectFrom('report')
        .select('id')
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()
      const closed = fixture.transitions.length % 2 === 1
      await db
        .updateTable('report')
        .set({
          createdAt: (fixture.createdAt ?? beforeWindow) as DatetimeString,
          status: closed
            ? 'closed'
            : 'status' in fixture
              ? fixture.status
              : 'open',
          closedAt: closed
            ? (fixture.transitions.at(-1) as DatetimeString)
            : null,
        })
        .where('id', '=', report.id)
        .execute()
      await db
        .deleteFrom('report_activity')
        .where('reportId', '=', report.id)
        .execute()
      const transitions = 'skipHistory' in fixture ? [] : fixture.transitions
      for (const [index, createdAt] of transitions.entries()) {
        await db
          .insertInto('report_activity')
          .values({
            reportId: report.id,
            activityType: index % 2 === 0 ? 'closeActivity' : 'reopenActivity',
            previousStatus: index % 2 === 0 ? 'open' : 'closed',
            internalNote: null,
            publicNote: null,
            meta: null,
            isAutomated: false,
            createdBy: sc.dids.alice as DidString,
            createdAt: createdAt as DatetimeString,
          })
          .execute()
      }

      try {
        await refreshStats({ startDate: firstDate, endDate: secondDate })
        await refreshStats({
          startDate: firstDate,
          endDate: secondDate,
          queueIds: [spamQueueId],
        })
        for (const filters of [
          {},
          { queueId: spamQueueId },
          { reportTypes: REPORT_TYPE_GROUPS.Legacy },
        ]) {
          const { stats } = await getHistoricalStats({
            ...filters,
            startDate: `${firstDate}T00:00:00.000Z`,
            endDate: `${secondDate}T23:59:59.999Z`,
          })
          expect(stats).toHaveLength(2)
          expect(
            stats.find((row) => row.date === firstDate)?.pendingCount,
          ).toBe(fixture.expected[0])
          expect(
            stats.find((row) => row.date === secondDate)?.pendingCount,
          ).toBe(fixture.expected[1])
        }
      } finally {
        await db
          .deleteFrom('report_activity')
          .where('reportId', '=', report.id)
          .execute()
        await db.deleteFrom('report').where('id', '=', report.id).execute()
      }
    })

    it.each([false, true])(
      'rejects future dates before writing any snapshots (queue filter: %s)',
      async (queueOnly) => {
        const db = network.ozone.ctx.db.db
        const today = currentDatetimeString().slice(0, 10)
        const tomorrow = toDatetimeString(Date.now() + 86400000).slice(0, 10)
        const before = await db
          .selectFrom('report_stat')
          .selectAll()
          .orderBy('id')
          .execute()
        await expect(
          refreshStats({
            startDate: today,
            endDate: tomorrow,
            queueIds: queueOnly ? [spamQueueId] : undefined,
          }),
        ).rejects.toMatchObject({ status: 400, error: 'InvalidRequest' })
        expect(
          await db
            .selectFrom('report_stat')
            .selectAll()
            .orderBy('id')
            .execute(),
        ).toEqual(before)
      },
    )

    it('refreshes a queue backlog without changing other queues', async () => {
      await modClient.computeStats()
      const db = network.ozone.ctx.db.db
      const today = currentDatetimeString().slice(0, 10) as DateString
      const expected = await getLiveStats({ queueId: spamQueueId })
      await db
        .updateTable('report_stat')
        .set({ pendingCount: -1, inboundCount: -1 })
        .where('date', '=', today)
        .where('queueId', '=', spamQueueId)
        .execute()
      const otherQueue = () =>
        db
          .selectFrom('report_stat')
          .selectAll()
          .where('date', '=', today)
          .where('queueId', '=', threatQueueId)
          .executeTakeFirstOrThrow()
      const before = await otherQueue()
      await refreshStats({
        startDate: today,
        endDate: today,
        queueIds: [spamQueueId],
      })
      const refreshed = await getLiveStats({ queueId: spamQueueId })
      expect(refreshed.pendingCount).toBe(expected.pendingCount)
      expect(refreshed.inboundCount).toBe(expected.inboundCount)
      expect(await otherQueue()).toEqual(before)
    })

    it.each([false, true])(
      'backfills an empty day (queue filter: %s)',
      async (queueOnly) => {
        const db = network.ozone.ctx.db.db
        const date = '1999-01-01'
        await db.deleteFrom('report_stat').where('date', '=', date).execute()
        await refreshStats({
          startDate: date,
          endDate: date,
          queueIds: queueOnly ? [spamQueueId] : undefined,
        })
        const result = await getHistoricalStats({
          startDate: `${date}T00:00:00.000Z`,
          endDate: `${date}T23:59:59.999Z`,
          queueId: queueOnly ? spamQueueId : undefined,
        })
        expect(result.stats).toHaveLength(1)
        expect(result.stats[0]).toMatchObject({
          pendingCount: 0,
          inboundCount: 0,
          closedCount: 0,
        })
        const moderatorRows = await db
          .selectFrom('report_stat')
          .select('pendingCount')
          .where('date', '=', date)
          .where('moderatorDid', 'is not', null)
          .execute()
        for (const row of moderatorRows) expect(row.pendingCount).toBeNull()
      },
    )
  })

  describe('daily finalization', () => {
    it.each([false, true])(
      'finalizes every group after a queue-only refresh (missing aggregate: %s)',
      async (missingAggregate) => {
        await modClient.computeStats()
        const db = network.ozone.ctx.db.db
        const yesterday = toDatetimeString(Date.now() - 86400000).slice(
          0,
          10,
        ) as DateString
        await db
          .updateTable('report_stat')
          .set({ pendingCount: -1, computedAt: `${yesterday}T23:59:59.999Z` })
          .where('date', '=', yesterday)
          .execute()
        if (missingAggregate) {
          await db
            .deleteFrom('report_stat')
            .where('date', '=', yesterday)
            .where('queueId', 'is', null)
            .where('moderatorDid', 'is', null)
            .where('reportTypes', 'is', null)
            .execute()
        }
        await refreshStats({
          startDate: yesterday,
          endDate: yesterday,
          queueIds: [spamQueueId],
        })
        await network.ozone.ctx
          .reportStatsService(network.ozone.ctx.db)
          .materializeAll()
        const rows = await db
          .selectFrom('report_stat')
          .selectAll()
          .where('date', '=', yesterday)
          .where('moderatorDid', 'is', null)
          .execute()
        expect(
          rows.some((r) => r.queueId === null && r.reportTypes === null),
        ).toBe(true)
        for (const row of rows) {
          expect(row.pendingCount).toBeGreaterThanOrEqual(0)
          expect(row.computedAt > `${yesterday}T23:59:59.999Z`).toBe(true)
        }
      },
    )

    it.each([false, true])(
      'keeps a refresh that crosses midnight eligible for finalization (queue filter: %s)',
      async (queueOnly) => {
        const db = network.ozone.ctx.db
        const service = new ReportStatsService(db)
        const midnight = new Date(
          `${currentDatetimeString().slice(0, 10)}T00:00:00.000Z`,
        ).getTime()
        const startedAt = toDatetimeString(midnight - 1)
        const date = startedAt.slice(0, 10) as DateString
        const computeStats = service['computeBatchedStats'].bind(service)
        using advanceClock = jest
          .spyOn(
            service as unknown as { computeBatchedStats: typeof computeStats },
            'computeBatchedStats',
          )
          .mockImplementationOnce(async (...args) => {
            const stats = await computeStats(...args)
            jest.setSystemTime(midnight + 1)
            return stats
          })
        jest.useFakeTimers({
          now: midnight - 1,
          doNotFake: [
            'hrtime',
            'nextTick',
            'performance',
            'queueMicrotask',
            'setImmediate',
            'clearImmediate',
            'setInterval',
            'clearInterval',
            'setTimeout',
            'clearTimeout',
          ],
        })
        try {
          await service.refreshDateRange({
            startDate: date,
            endDate: date,
            queueIds: queueOnly ? [spamQueueId] : undefined,
          })
        } finally {
          jest.useRealTimers()
        }
        expect(advanceClock).toHaveBeenCalled()
        const row = await db.db
          .selectFrom('report_stat')
          .select('computedAt')
          .where('date', '=', date)
          .where('queueId', '=', spamQueueId)
          .executeTakeFirstOrThrow()
        expect(row.computedAt).toBe(startedAt)
        if (!queueOnly) {
          await service.materializeAll()
          const finalized = await db.db
            .selectFrom('report_stat')
            .select('computedAt')
            .where('date', '=', date)
            .where('queueId', '=', spamQueueId)
            .executeTakeFirstOrThrow()
          expect(
            new Date(finalized.computedAt).getTime(),
          ).toBeGreaterThanOrEqual(midnight)
        }
      },
    )
  })

  describe('historical stats', () => {
    it('returns historical aggregate stats with date field', async () => {
      await modClient.computeStats()

      const result = await getHistoricalStats()
      expect(result.stats.length).toBeGreaterThanOrEqual(1)

      const first = result.stats[0]
      expect(first.date).toBeDefined()
      expect(first.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(first.inboundCount).toBeGreaterThanOrEqual(0)
    })

    it('returns historical per-queue stats', async () => {
      await modClient.computeStats()

      const result = await getHistoricalStats({ queueId: spamQueueId })
      expect(result.stats.length).toBeGreaterThanOrEqual(1)
      expect(result.stats[0].date).toBeDefined()
      expect(result.stats[0].inboundCount).toBeGreaterThanOrEqual(0)
    })

    it('supports pagination with limit and cursor', async () => {
      await modClient.computeStats()

      const page1 = await getHistoricalStats({ limit: 1 })
      expect(page1.stats.length).toBe(1)

      if (page1.cursor) {
        const page2 = await getHistoricalStats({
          limit: 1,
          cursor: page1.cursor,
        })
        expect(page2.stats.length).toBeLessThanOrEqual(1)
      }
    })

    it('supports date range filtering', async () => {
      await modClient.computeStats()

      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const todayStr = now.toISOString().slice(0, 10)
      const yesterdayStr = yesterday.toISOString().slice(0, 10)

      const result = await getHistoricalStats({
        startDate: yesterday.toISOString(),
        endDate: now.toISOString(),
      })
      for (const stat of result.stats) {
        expect(stat.date >= yesterdayStr).toBe(true)
        expect(stat.date <= todayStr).toBe(true)
      }
    })
  })
})
