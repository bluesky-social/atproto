import AtpAgent from '@atproto/api'
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

  const computeStats = async () => {
    const db = network.ozone.ctx.db
    const statsService = network.ozone.ctx.reportStatsService(db)
    await statsService.materializeAll({ force: true })
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
    const [spamQueue, harassmentQueue] = await Promise.all([
      createQueue({
        name: 'Stats: Spam Accounts',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
      }),
      createQueue({
        name: 'Stats: Harassment Accounts',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonHarassment'],
      }),
    ])
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
    await computeStats()
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
    // Take action on alice's report and close associated reports
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
      },
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
      reportAction: { all: true },
    })
    await computeStats()
    const stats = await getLiveQueueStats(spamQueueId)

    expect(stats.pendingCount).toBe(1)
    expect(stats.actionedCount).toBeGreaterThanOrEqual(1)
    expect(stats.avgHandlingTimeSec).toBeDefined()
    expect(stats.avgHandlingTimeSec).toBeGreaterThanOrEqual(0)
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
    await computeStats()
    const stats = await getLiveModeratorStats(moderatorDid)
    const avgHandlingTime = ages.reduce((a, b) => a + b, 0) / ages.length
    expect(stats.avgHandlingTimeSec).toBeDefined()
    expect(stats.avgHandlingTimeSec).toBeGreaterThanOrEqual(avgHandlingTime - 5)
    expect(stats.avgHandlingTimeSec).toBeLessThanOrEqual(avgHandlingTime + 5)
  })

  it('returns zeroed stats for empty queue', async () => {
    const emptyQueue = await createQueue({
      name: 'Stats: Empty Queue',
      subjectTypes: ['record'],
      reportTypes: ['com.atproto.moderation.defs#reasonOther'],
    })
    await computeStats()
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
    await computeStats()
    const stats = await getLiveQueueStats()

    // Aggregate includes all reports (queued + unqueued)
    expect(stats.pendingCount).toBeGreaterThanOrEqual(1)
  })

  it('returns per-moderator stats after action', async () => {
    // The moderator (default role) took action on alice earlier in 'reflects status changes after recompute'
    const moderatorDid = network.ozone.moderatorAccnt.did
    await computeStats()
    const stats = await getLiveModeratorStats(moderatorDid)

    expect(stats.actionedCount).toBeGreaterThanOrEqual(1)
    expect(stats.lastUpdated).toBeDefined()
  })

  it('returns zeroed per-moderator stats for inactive moderator', async () => {
    // Use a DID that hasn't taken any actions
    const triageDid = network.ozone.triageAccnt.did
    await computeStats()
    const stats = await getLiveModeratorStats(triageDid)

    expect(stats.actionedCount).toBe(0)
    expect(stats.escalatedPendingCount).toBe(0)
    // assignedCount and pendingCount are not computed for per-moderator stats
    expect(stats.assignedCount).toBeUndefined()
    expect(stats.pendingCount).toBeUndefined()
  })
})
