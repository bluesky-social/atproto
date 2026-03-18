import AtpAgent from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'

const REASON_SPAM = 'com.atproto.moderation.defs#reasonSpam'
const REASON_HARASSMENT = 'com.atproto.moderation.defs#reasonHarassment'

describe('getLiveStats', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

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

  const reportAccount = async (did: string, reportType: string) => {
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReport',
        reportType,
        comment: 'automated test report',
      },
      subject: { $type: 'com.atproto.admin.defs#repoRef', did },
    })
  }

  const getLiveStats = async (queueId?: number) => {
    const params = queueId !== undefined ? { queueId } : {}
    const { data } = await agent.tools.ozone.queue.getLiveStats(params, {
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneQueueGetLiveStats,
        'admin',
      ),
    })
    return data.stats
  }

  const computeStats = async () => {
    const db = network.ozone.ctx.db
    const statsService = network.ozone.ctx.reportStatsService(db)
    await statsService.computeLiveStats()
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
  })

  afterAll(async () => {
    await network.close()
  })

  it('returns zeroed aggregate stats when no reports exist', async () => {
    await computeStats()
    const stats = await getLiveStats()

    expect(stats.pendingCount).toBe(0)
    expect(stats.actionedCount).toBe(0)
    expect(stats.escalatedPendingCount).toBe(0)
    expect(stats.lastUpdated).toBeDefined()
  })

  describe('with queues and reports', () => {
    let spamQueueId: number
    let harassmentQueueId: number

    beforeAll(async () => {
      const [spamQueue, harassmentQueue] = await Promise.all([
        createQueue({
          name: 'Stats: Spam Accounts',
          subjectTypes: ['account'],
          reportTypes: [REASON_SPAM],
        }),
        createQueue({
          name: 'Stats: Harassment Accounts',
          subjectTypes: ['account'],
          reportTypes: [REASON_HARASSMENT],
        }),
      ])
      spamQueueId = spamQueue.id
      harassmentQueueId = harassmentQueue.id

      // Create reports and route them
      await reportAccount(sc.dids.alice, REASON_SPAM)
      await reportAccount(sc.dids.bob, REASON_SPAM)
      await reportAccount(sc.dids.carol, REASON_HARASSMENT)
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      await computeStats()
    })

    it('returns stats when no queueId provided', async () => {
      const stats = await getLiveStats()

      expect(typeof stats.pendingCount).toBe('number')
      expect(typeof stats.inboundCount).toBe('number')
      expect(typeof stats.actionedCount).toBe('number')
      expect(typeof stats.escalatedPendingCount).toBe('number')
      expect(stats.lastUpdated).toBeDefined()
    })

    it('returns per-queue stats for spam queue', async () => {
      const stats = await getLiveStats(spamQueueId)

      expect(stats.pendingCount).toBe(2) // alice + bob
      expect(stats.inboundCount).toBeGreaterThanOrEqual(2)
    })

    it('returns per-queue stats for harassment queue', async () => {
      const stats = await getLiveStats(harassmentQueueId)

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

      const stats = await getLiveStats(spamQueueId)

      expect(stats.pendingCount).toBe(1) // only bob remains open
      expect(stats.actionedCount).toBeGreaterThanOrEqual(1)
    })

    it('computes actionRate when inbound > 0', async () => {
      const stats = await getLiveStats(spamQueueId)

      if (stats.inboundCount && stats.inboundCount > 0) {
        expect(stats.actionRate).toBe(
          Math.round(((stats.actionedCount ?? 0) / stats.inboundCount) * 100),
        )
      }
    })

    it('returns zeroed stats for empty queue', async () => {
      const emptyQueue = await createQueue({
        name: 'Stats: Empty Queue',
        subjectTypes: ['record'],
        reportTypes: ['com.atproto.moderation.defs#reasonOther'],
      })
      await computeStats()

      const stats = await getLiveStats(emptyQueue.id)

      expect(stats.pendingCount).toBe(0)
      expect(stats.inboundCount).toBe(0)
    })

    it('includes unqueued reports in aggregate', async () => {
      // Report with a reason that matches no queue
      await reportAccount(
        sc.dids.dan,
        'com.atproto.moderation.defs#reasonMisleading',
      )
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      await computeStats()

      const stats = await getLiveStats()

      // Aggregate includes all reports (queued + unqueued)
      expect(stats.pendingCount).toBeGreaterThanOrEqual(1)
    })
  })
})
