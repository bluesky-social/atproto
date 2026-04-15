import { sql } from 'kysely'
import AtpAgent from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import { REPORT_TYPE_GROUPS } from '../src/report/stats'

describe('report-stats', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient
  let spamQueueId: number
  let harassmentQueueId: number

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

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_stats',
    })
    agent = network.ozone.getClient()
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
    const harassmentQueue = await createQueue({
      name: 'Stats: Harassment Accounts',
      subjectTypes: ['account'],
      reportTypes: ['com.atproto.moderation.defs#reasonHarassment'],
    })
    spamQueueId = spamQueue.id
    harassmentQueueId = harassmentQueue.id

    // seed reports
    await sc.createReport({
      reasonType: 'com.atproto.moderation.defs#reasonSpam',
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
      reportedBy: sc.dids.bob,
    })
    await sc.createReport({
      reasonType: 'com.atproto.moderation.defs#reasonSpam',
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.bob,
      },
      reportedBy: sc.dids.alice,
    })
    await sc.createReport({
      reasonType: 'com.atproto.moderation.defs#reasonHarassment',
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.carol,
      },
      reportedBy: sc.dids.alice,
    })
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    await modClient.computeStats()
  })

  afterAll(async () => {
    await network.close()
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
          did: sc.dids.carol,
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
          did: sc.dids.alice,
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
        .set({ createdAt: oldDate, updatedAt: oldDate })
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

    it('returns per-queue stats for harassment queue', async () => {
      const stats = await getLiveStats({ queueId: harassmentQueueId })
      expect(stats.pendingCount).toBeGreaterThanOrEqual(1)
    })

    it('reflects status changes after recompute', async () => {
      const stats1 = await getLiveStats({ queueId: spamQueueId })

      await sc.createReport({
        reasonType: 'com.atproto.moderation.defs#reasonSpam',
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.carol,
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
          did: sc.dids.alice,
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

      // Create reports, assign moderator, backdate assignment, then close
      const ages = [30, 60, 90]
      for (const ts of ages) {
        await sc.createReport({
          reasonType: 'com.atproto.moderation.defs#reasonOther',
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.carol,
          },
          reportedBy: sc.dids.bob,
        })
        const backdate = new Date(Date.now() - ts * 1000).toISOString()
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
          })
          .where('id', '=', report.id)
          .execute()
        await db.db
          .insertInto('moderator_assignment')
          .values({
            did: moderatorDid,
            reportId: report.id,
            queueId: null,
            startAt: backdate,
            endAt: null,
          })
          .execute()
        await modClient.emitEvent(
          {
            event: {
              $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
            },
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.carol,
            },
            reportAction: { all: true },
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
      expect(stats.escalatedCount).toBeUndefined()
      expect(stats.pendingCount).toBeUndefined()
    })
  })

  describe('report type group', () => {
    it('computes per-group stats for Legacy group', async () => {
      await modClient.computeStats()

      const legacyStats = await getLiveStats({
        reportTypes: REPORT_TYPE_GROUPS['Legacy'],
      })
      const allStats = await getLiveStats()

      // Legacy group includes spam, harassment, etc. seeded above
      expect(legacyStats.inboundCount).toBeGreaterThanOrEqual(3)

      // Aggregate should be >= legacy group
      expect(allStats.inboundCount).toBeGreaterThanOrEqual(
        legacyStats.inboundCount!,
      )
    })

    it('only counts matching report types within group', async () => {
      await modClient.computeStats()

      const legacyStats = await getLiveStats({
        reportTypes: REPORT_TYPE_GROUPS['Legacy'],
      })

      // Legacy group should include all seeded spam + harassment + misleading + other reports
      expect(legacyStats.inboundCount).toBeGreaterThanOrEqual(3)
      expect(legacyStats.pendingCount).toBeGreaterThanOrEqual(0)
    })

    it('tracks escalated counts within group', async () => {
      const db = network.ozone.ctx.db

      await sc.createReport({
        reasonType: 'com.atproto.moderation.defs#reasonSpam',
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
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
        .set({ status: 'escalated', updatedAt: new Date().toISOString() })
        .where('id', '=', report.id)
        .execute()

      await modClient.computeStats()

      const stats = await getLiveStats({
        reportTypes: REPORT_TYPE_GROUPS['Legacy'],
      })
      expect(stats.escalatedCount).toBeGreaterThanOrEqual(1)
    })

    it('returns zeroed stats for unused report type group', async () => {
      await modClient.computeStats()

      // Violence group has no seeded reports: all counts should be 0
      const stats = await getLiveStats({
        reportTypes: REPORT_TYPE_GROUPS['Violence'],
      })
      expect(stats.inboundCount).toBe(0)
      expect(stats.pendingCount).toBe(0)
    })

    it('handles avg handling time within group', async () => {
      const db = network.ozone.ctx.db

      await sc.createReport({
        reasonType: 'com.atproto.moderation.defs#reasonRude',
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.alice,
        },
        reportedBy: sc.dids.carol,
      })
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await db.db
        .selectFrom('report')
        .select(['id'])
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()

      const backdate = new Date(Date.now() - 120 * 1000).toISOString()
      const now = new Date().toISOString()
      await db.db
        .updateTable('report')
        .set({
          createdAt: backdate,
          updatedAt: now,
          closedAt: now,
          status: 'closed',
        })
        .where('id', '=', report.id)
        .execute()

      await modClient.computeStats()

      const stats = await getLiveStats({
        reportTypes: REPORT_TYPE_GROUPS['Legacy'],
      })
      expect(stats.actionedCount).toBeGreaterThanOrEqual(1)
      expect(stats.avgHandlingTimeSec).toBeDefined()
      // Group includes all legacy types; avg is diluted by other closed reports
      expect(stats.avgHandlingTimeSec).toBeGreaterThanOrEqual(1)
    })
  })

  describe('historical stats', () => {
    it('returns historical aggregate stats', async () => {
      await modClient.computeStats()

      const result = await getHistoricalStats()
      expect(result.stats.length).toBeGreaterThanOrEqual(1)

      const first = result.stats[0]
      expect(first.computedAt).toBeDefined()
      expect(first.inboundCount).toBeGreaterThanOrEqual(0)
    })

    it('returns historical per-queue stats', async () => {
      await modClient.computeStats()

      const result = await getHistoricalStats({ queueId: spamQueueId })
      expect(result.stats.length).toBeGreaterThanOrEqual(1)
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
        if (page2.stats.length > 0) {
          // Entries should be ordered desc by computedAt
          expect(page1.stats[0].computedAt >= page2.stats[0].computedAt).toBe(
            true,
          )
        }
      }
    })

    it('supports date range filtering', async () => {
      await modClient.computeStats()

      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      const result = await getHistoricalStats({
        startDate: yesterday.toISOString(),
        endDate: now.toISOString(),
      })
      for (const stat of result.stats) {
        expect(new Date(stat.computedAt).getTime()).toBeGreaterThanOrEqual(
          yesterday.getTime(),
        )
        expect(new Date(stat.computedAt).getTime()).toBeLessThanOrEqual(
          now.getTime() + 1000,
        )
      }
    })
  })
})
