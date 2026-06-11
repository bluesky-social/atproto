import AtpAgent from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons.js'

const REASON_SPAM = 'com.atproto.moderation.defs#reasonSpam'
const REASON_MISLEADING = 'com.atproto.moderation.defs#reasonMisleading'
const REASON_OTHER = 'tools.ozone.report.defs#reasonOther'

describe('queue-id-routing', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

  const modHeaders = (nsid: string) => network.ozone.modHeaders(nsid, 'admin')

  const createQueue = async (input: {
    name: string
    subjectTypes: string[]
    reportTypes: string[]
    collection?: string
  }) => {
    const { data } = await agent.tools.ozone.queue.createQueue(input, {
      encoding: 'application/json',
      headers: await modHeaders(ids.ToolsOzoneQueueCreateQueue),
    })
    return data.queue
  }

  const updateQueue = async (input: {
    queueId: number
    name?: string
    enabled?: boolean
  }) => {
    const { data } = await agent.tools.ozone.queue.updateQueue(input, {
      encoding: 'application/json',
      headers: await modHeaders(ids.ToolsOzoneQueueUpdateQueue),
    })
    return data.queue
  }

  // Emits an account-level report, optionally stamped with an Osprey-style
  // modTool carrying an explicit destination queue id.
  const reportAccount = async (
    did: string,
    reportType: string,
    queueId?: number,
  ) => {
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReport',
        reportType,
        comment: 'automated test report',
      },
      subject: { $type: 'com.atproto.admin.defs#repoRef', did },
      modTool:
        queueId !== undefined
          ? {
              name: 'osprey-effector',
              meta: { rules: ['test_rule'], queueId },
            }
          : undefined,
    })
  }

  const queryLatestReportForSubject = async (
    subjectOrUri: string,
    status: 'open' | 'closed' | 'escalated' | 'queued' | 'assigned' = 'queued',
  ) => {
    const { reports } = await modClient.queryReports({
      status,
      subject: subjectOrUri,
    })
    return reports[0]
  }

  const routeReports = async (startReportId: number, endReportId: number) => {
    const { data } = await agent.tools.ozone.queue.routeReports(
      { startReportId, endReportId },
      {
        encoding: 'application/json',
        headers: await modHeaders(ids.ToolsOzoneQueueRouteReports),
      },
    )
    return data
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_queue_id_routing',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('daemon routing on modTool.meta.queueId', () => {
    let customQueueId: number
    let attributeQueueId: number

    beforeAll(async () => {
      // The custom queue's attributes deliberately won't match any report
      // emitted in these tests (the reports are account-level spam/misleading)
      // so a report landing here proves the explicit id bypassed attribute
      // matching rather than matching organically.
      const [customQueue, attributeQueue] = await Promise.all([
        createQueue({
          name: 'Osprey Custom Queue',
          subjectTypes: ['record'],
          reportTypes: [REASON_OTHER],
          collection: 'app.bsky.feed.generator',
        }),
        createQueue({
          name: 'Spam Accounts Attr Queue',
          subjectTypes: ['account'],
          reportTypes: [REASON_SPAM],
        }),
      ])
      customQueueId = customQueue.id
      attributeQueueId = attributeQueue.id
    })

    it('routes a report with a valid queueId to that queue, overriding attribute matching', async () => {
      // REASON_SPAM on an account would attribute-match the spam queue, but
      // the explicit queue id must win.
      await reportAccount(sc.dids.bob, REASON_SPAM, customQueueId)

      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await queryLatestReportForSubject(sc.dids.bob)
      expect(report).toBeDefined()
      expect(report.queue?.id).toBe(customQueueId)
      expect(report.modTool?.name).toBe('osprey-effector')
    })

    it('falls back to attribute matching when no queueId is present', async () => {
      await reportAccount(sc.dids.carol, REASON_SPAM)

      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await queryLatestReportForSubject(sc.dids.carol)
      expect(report).toBeDefined()
      expect(report.queue?.id).toBe(attributeQueueId)
      expect(report.modTool).toBeUndefined()
    })

    it('routes to -1 (unrouted) on an unknown queueId instead of attribute matching', async () => {
      // Attribute matching would route this spam report to the spam queue,
      // but a misconfigured id must surface as unrouted, not silently land
      // in a wrong queue.
      await reportAccount(sc.dids.alice, REASON_SPAM, 999999)

      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await queryLatestReportForSubject(sc.dids.alice, 'open')
      expect(report).toBeDefined()
      expect(report.queue).toBeUndefined()
      expect(report.queuedAt).toBeUndefined()
    })

    it('routes to -1 (unrouted) when the queueId names a disabled queue', async () => {
      await updateQueue({ queueId: customQueueId, enabled: false })

      await reportAccount(sc.dids.dan, REASON_MISLEADING, customQueueId)
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await queryLatestReportForSubject(sc.dids.dan, 'open')
      expect(report).toBeDefined()
      expect(report.queue).toBeUndefined()

      await updateQueue({ queueId: customQueueId, enabled: true })
    })

    it('re-routes via routeReports honoring the queueId from the originating event', async () => {
      // dan's report above landed at -1 while the custom queue was disabled.
      // Now that the queue is re-enabled, a manual re-route should pick the
      // id back up off the immutable event.
      const report = await queryLatestReportForSubject(sc.dids.dan, 'open')
      expect(report).toBeDefined()

      const result = await routeReports(report.id, report.id)
      expect(result.assigned).toBe(1)

      const rerouted = await queryLatestReportForSubject(sc.dids.dan)
      expect(rerouted.id).toBe(report.id)
      expect(rerouted.queue?.id).toBe(customQueueId)
    })
  })
})
