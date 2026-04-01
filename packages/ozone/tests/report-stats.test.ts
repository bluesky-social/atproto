import AtpAgent from '@atproto/api'
import { sql } from 'kysely'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'

describe('live', () => {
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

  const getLiveQueueStats = async (queueId?: number) => {
    const { data } = await agent.tools.ozone.queue.getLiveStats(
      { queueId },
      {
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneQueueGetLiveStats,
          'admin',
        ),
      },
    )
    return data.stats
  }

  const getLiveModeratorStats = async (moderatorDid: string) => {
    const { data } = await agent.tools.ozone.report.getLiveModeratorStats(
      { moderatorDid },
      {
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneReportGetLiveModeratorStats,
          'admin',
        ),
      },
    )
    return data.stats
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

    // seed
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

  it('returns aggregate stats when no queueId provided', async () => {
    const stats = await getLiveQueueStats()
    expect(stats.inboundCount).toBeGreaterThanOrEqual(3)
    expect(stats.lastUpdated).toBeDefined()
  })

  it('returns per-queue stats for spam queue', async () => {
    const stats = await getLiveQueueStats(spamQueueId)
    expect(stats.pendingCount).toBe(2) // alice + bob
    expect(stats.inboundCount).toBeGreaterThanOrEqual(2)
  })

  it('returns per-queue stats for harassment queue', async () => {
    const stats = await getLiveQueueStats(harassmentQueueId)
    expect(stats.pendingCount).toBe(1) // carol
  })

  it('reflects status changes after recompute', async () => {
    const stats1 = await getLiveQueueStats(spamQueueId)

    // create report
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
    const stats2 = await getLiveQueueStats(spamQueueId)

    expect(stats2.pendingCount! - stats1.pendingCount!).toBe(1)
    expect(stats2.inboundCount! - stats1.inboundCount!).toBe(1)
  })

  it('average handling time', async () => {
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
      // Set report to open and backdate createdAt
      await db.db
        .updateTable('report')
        .set({
          status: 'open',
          createdAt: backdate,
          updatedAt: backdate,
        })
        .where('id', '=', report.id)
        .execute()
      // Create a moderator assignment with startAt = backdate
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

      // Close the report
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

    // get updated stats and check
    await modClient.computeStats()
    const stats = await getLiveModeratorStats(moderatorDid)
    const avgHandlingTime = ages.reduce((a, b) => a + b, 0) / ages.length
    expect(stats.avgHandlingTimeSec).toBeDefined()
    expect(stats.avgHandlingTimeSec).toBeGreaterThanOrEqual(avgHandlingTime - 5)
    expect(stats.avgHandlingTimeSec).toBeLessThanOrEqual(avgHandlingTime + 5)
  })

  it('pendingCount includes reports created before the time window', async () => {
    const db = network.ozone.ctx.db

    // Create a report and backdate it beyond the 24h window
    await sc.createReport({
      reasonType: 'com.atproto.moderation.defs#reasonSpam',
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
      reportedBy: sc.dids.carol,
    })
    await network.ozone.daemon.ctx.queueRouter.routeReports()

    // Backdate the report's createdAt to 3 days ago
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
    const aggregateStats = await getLiveQueueStats()
    const queueStats = await getLiveQueueStats(spamQueueId)

    // The backdated report should still be counted in pendingCount
    expect(aggregateStats.pendingCount).toBeGreaterThanOrEqual(1)
    expect(queueStats.pendingCount).toBeGreaterThanOrEqual(1)
  })

  it('returns zeroed stats for empty queue', async () => {
    const emptyQueue = await createQueue({
      name: 'Stats: Empty Queue',
      subjectTypes: ['record'],
      reportTypes: ['com.atproto.moderation.defs#reasonOther'],
    })
    await modClient.computeStats()
    const stats = await getLiveQueueStats(emptyQueue.id)

    expect(stats.pendingCount).toBe(0)
    expect(stats.inboundCount).toBe(0)
    expect(stats.avgHandlingTimeSec).toBeUndefined()
  })

  it('includes unqueued reports in aggregate', async () => {
    // Report with a reason that matches no queue
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
    const stats = await getLiveQueueStats()

    // Aggregate includes all reports (queued + unqueued)
    expect(stats.pendingCount).toBeGreaterThanOrEqual(1)
  })

  it('computes live stats for unqueued reports (queueId = -1)', async () => {
    const db = network.ozone.ctx.db

    // Count how many reports are currently unqueued (queueId = -1)
    const unqueuedBefore = await db.db
      .selectFrom('report')
      .select(sql<number>`count(*)`.as('count'))
      .where('queueId', '=', -1)
      .where('status', '!=', 'closed')
      .executeTakeFirstOrThrow()

    // Create a report with a reason that won't match any queue
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

    // Verify the report ended up unqueued
    const unqueuedAfter = await db.db
      .selectFrom('report')
      .select(sql<number>`count(*)`.as('count'))
      .where('queueId', '=', -1)
      .where('status', '!=', 'closed')
      .executeTakeFirstOrThrow()
    expect(Number(unqueuedAfter.count)).toBe(Number(unqueuedBefore.count) + 1)

    // Fetch unqueued stats via queueId = -1
    const stats = await getLiveQueueStats(-1)
    expect(stats.pendingCount).toBe(Number(unqueuedAfter.count))
    expect(stats.inboundCount).toBeGreaterThanOrEqual(1)
    expect(stats.lastUpdated).toBeDefined()
  })

  it('unqueued stats are separate from aggregate stats', async () => {
    await modClient.computeStats()

    const aggregateStats = await getLiveQueueStats()
    const unqueuedStats = await getLiveQueueStats(-1)

    // Aggregate pendingCount should be >= unqueued pendingCount
    // since aggregate includes all reports
    expect(aggregateStats.pendingCount).toBeGreaterThanOrEqual(
      unqueuedStats.pendingCount ?? 0,
    )
  })

  it('returns per-moderator stats after action', async () => {
    // The moderator (default role) took action on alice earlier in 'reflects status changes after recompute'
    const moderatorDid = network.ozone.moderatorAccnt.did
    await modClient.computeStats()
    const stats = await getLiveModeratorStats(moderatorDid)

    expect(stats.actionedCount).toBeGreaterThanOrEqual(1)
    expect(stats.lastUpdated).toBeDefined()
  })

  it('returns zeroed per-moderator stats for inactive moderator', async () => {
    // Use a DID that hasn't taken any actions
    const triageDid = network.ozone.triageAccnt.did
    await modClient.computeStats()
    const stats = await getLiveModeratorStats(triageDid)

    expect(stats.actionedCount).toBe(0)
    expect(stats.assignedCount).toBe(0)
    expect(stats.escalatedPendingCount).toBeUndefined()
    expect(stats.pendingCount).toBeUndefined()
  })

  it('computes per-reportType aggregate stats', async () => {
    const statsService = network.ozone.ctx.reportStatsService(
      network.ozone.ctx.db,
    )
    await statsService.materializeAll({ force: true })

    const spamStats = await statsService.getLiveReportTypeStats([
      'com.atproto.moderation.defs#reasonSpam',
    ])
    const harassmentStats = await statsService.getLiveReportTypeStats([
      'com.atproto.moderation.defs#reasonHarassment',
    ])
    const allStats = await statsService.getLiveAggregateStats()

    // Spam aggregate should only count spam reports
    expect(spamStats).toBeDefined()
    expect(spamStats!.inboundCount).toBeGreaterThanOrEqual(1)

    // Harassment aggregate should only count harassment reports
    expect(harassmentStats).toBeDefined()
    expect(harassmentStats!.inboundCount).toBeGreaterThanOrEqual(1)

    // All-types aggregate should be >= sum of individual types
    expect(allStats).toBeDefined()
    expect(allStats!.inboundCount).toBeGreaterThanOrEqual(
      spamStats!.inboundCount! + harassmentStats!.inboundCount!,
    )
  })

  it('null reportTypes returns same as all-types aggregate', async () => {
    const statsService = network.ozone.ctx.reportStatsService(
      network.ozone.ctx.db,
    )
    await statsService.materializeAll({ force: true })

    // Calling without reportTypes should return all-types aggregate
    const viaApi = await getLiveQueueStats()
    const viaService = await statsService.getLiveAggregateStats()

    expect(viaService).toBeDefined()
    expect(viaService!.inboundCount).toBe(viaApi.inboundCount)
    expect(viaService!.pendingCount).toBe(viaApi.pendingCount)
  })
})
