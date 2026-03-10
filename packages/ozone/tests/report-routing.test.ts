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
const REASON_MISLEADING = 'com.atproto.moderation.defs#reasonMisleading'

describe('queue-router', () => {
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

  const deleteQueue = async (queueId: number) => {
    await agent.tools.ozone.queue.deleteQueue(
      { queueId },
      {
        encoding: 'application/json',
        headers: await modHeaders(ids.ToolsOzoneQueueDeleteQueue),
      },
    )
  }

  // Creates a report event (account-level) directly via modClient for a given DID + reason
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

  // Creates a record-level report event via modClient
  const reportRecord = async (uri: string, cid: string, reportType: string) => {
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReport',
        reportType,
        comment: 'automated test report',
      },
      subject: { $type: 'com.atproto.repo.strongRef', uri, cid },
    })
  }

  // Returns the most recent report row for a subject directly from the DB.
  // Pass a DID for account subjects or an at:// URI for record subjects.
  const getLatestReportForSubject = async (subjectOrUri: string) => {
    const db = network.ozone.daemon.ctx.db
    const isDid = subjectOrUri.startsWith('did:')
    let query = db.db
      .selectFrom('report as r')
      .innerJoin('moderation_event as me', 'me.id', 'r.eventId')
      .select(['r.id', 'r.queueId', 'r.queuedAt', 'r.status'])
      .orderBy('r.id', 'desc')
      .limit(1)
    if (isDid) {
      query = query
        .where('me.subjectDid', '=', subjectOrUri)
        .where('me.subjectUri', 'is', null)
    } else {
      query = query.where('me.subjectUri', '=', subjectOrUri)
    }
    return query.executeTakeFirstOrThrow()
  }

  const getLatest = async () => {
    const { data } = await agent.tools.ozone.queue.getLatest(
      {},
      { headers: await modHeaders(ids.ToolsOzoneQueueGetLatest) },
    )
    return data.report
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

  const clearQueues = async () => {
    const db = network.ozone.ctx.db.db
    await db.deleteFrom('report_queue').execute()
  }

  let spamAccountQueueId: number
  let harassmentAccountQueueId: number
  let spamPostQueueId: number

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_routing',
    })
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
    await clearQueues()
    const [spamAccountQueue, harassmentAccountQueue, spamPostQueue] =
      await Promise.all([
        createQueue({
          name: 'QR: Spam Accounts',
          subjectTypes: ['account'],
          reportTypes: [REASON_SPAM],
        }),
        createQueue({
          name: 'QR: Harassment Accounts',
          subjectTypes: ['account'],
          reportTypes: [REASON_HARASSMENT],
        }),
        createQueue({
          name: 'QR: Spam Posts',
          subjectTypes: ['record'],
          reportTypes: [REASON_SPAM],
          collection: 'app.bsky.feed.post',
        }),
      ])
    spamAccountQueueId = spamAccountQueue.id
    harassmentAccountQueueId = harassmentAccountQueue.id
    spamPostQueueId = spamPostQueue.id
  })

  afterAll(async () => {
    await network.close()
  })

  it('routes unassigned AND unmatched reports to a newly created queue', async () => {
    // Create unmatchable report (queueId will be set to -1)
    await reportAccount(sc.dids.bob, REASON_MISLEADING)
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    const unmatchedReport = await getLatestReportForSubject(sc.dids.bob)
    expect(unmatchedReport.queueId).toBe(-1)

    // Create an unassigned report
    await reportAccount(sc.dids.carol, REASON_MISLEADING)
    const unassignedReport = await getLatestReportForSubject(sc.dids.carol)
    expect(unassignedReport.queueId).toBeNull()

    // Create a queue that now matches misleading account reports
    const misleadingQueue = await createQueue({
      name: 'QR: Misleading Accounts',
      subjectTypes: ['account'],
      reportTypes: [REASON_MISLEADING],
    })

    // Re-route both reports
    const startId = Math.min(unmatchedReport.id, unassignedReport.id)
    const endId = Math.max(unmatchedReport.id, unassignedReport.id)
    const result = await routeReports(startId, endId)
    expect(result.assigned).toBe(2)
    expect(result.unmatched).toBe(0)

    // Verify both reports match
    const unmatchedAfter = await getLatestReportForSubject(sc.dids.bob)
    expect(unmatchedAfter.queueId).toBe(misleadingQueue.id)
    const unassignedAfter = await getLatestReportForSubject(sc.dids.carol)
    expect(unassignedAfter.queueId).toBe(misleadingQueue.id)

    // cleanup
    await deleteQueue(misleadingQueue.id)
  })

  it('skips reports already assigned to a valid queue', async () => {
    await reportAccount(sc.dids.bob, REASON_SPAM)
    await network.ozone.daemon.ctx.queueRouter.routeReports()

    const reportBob = await getLatestReportForSubject(sc.dids.bob)
    expect(reportBob.queueId).toBe(spamAccountQueueId)

    // Report is already assigned — endpoint only processes null/unmatched
    const result = await routeReports(reportBob.id, reportBob.id)
    expect(result.assigned).toBe(0)
    expect(result.unmatched).toBe(0)
  })

  it('rejects when startReportId > endReportId', async () => {
    await expect(routeReports(100, 50)).rejects.toThrow(
      'startReportId must be less than or equal to endReportId',
    )
  })

  it('rejects when more than 5000 reports', async () => {
    await expect(routeReports(100, 5101)).rejects.toThrow(
      'Cannot route more than 5000 reports at a time',
    )
  })

  describe('get latest report', () => {
    it('returns latest report', async () => {
      // Create a new report so we know what the latest should be
      await reportAccount(sc.dids.dan, REASON_SPAM)

      const latest = await getLatest()
      expect(latest).toBeDefined()
      expect(latest.id).toBeGreaterThan(0)

      // Verify it matches the DB
      const dbReport = await getLatestReportForSubject(sc.dids.dan)
      expect(latest.id).toBe(dbReport.id)
    })

    it('returns a newer report after creating one', async () => {
      const first = await getLatest()

      await reportAccount(sc.dids.alice, REASON_HARASSMENT)

      const second = await getLatest()
      expect(second.id).toBeGreaterThan(first.id)
    })
  })
})
