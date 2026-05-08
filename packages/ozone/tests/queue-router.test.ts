import AtpAgent from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'

const REASON_SPAM = 'com.atproto.moderation.defs#reasonSpam'
const REASON_THREAT = 'tools.ozone.report.defs#reasonViolenceThreats'
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

  // Returns the most recent report for a subject using the queryReports API.
  // Pass a DID for account subjects or an at:// URI for record subjects.
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

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_queue_router',
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

  it('inserts report rows with no queue assignment when no queues are configured', async () => {
    // This test intentionally runs before any queues are created. The daemon
    // still inserts the report row (with queueId = -1) so the invariant
    // "every modEventReport has a corresponding report row" holds.
    await reportAccount(sc.dids.alice, REASON_SPAM)

    await network.ozone.daemon.ctx.queueRouter.routeReports()

    // Cursor advances past the processed event
    const cursor = await network.ozone.daemon.ctx.queueRouter.getCursor()
    expect(cursor).not.toBeNull()
    expect(cursor!).toBeGreaterThan(0)

    // Report row exists with no queue (queueId = -1 surfaces as undefined)
    const report = await queryLatestReportForSubject(sc.dids.alice, 'open')
    expect(report).toBeDefined()
    expect(report.queue).toBeUndefined()
  })

  describe('with queues configured', () => {
    let spamAccountQueueId: number
    let threatAccountQueueId: number
    let spamPostQueueId: number

    beforeAll(async () => {
      const [spamAccountQueue, threatAccountQueue, spamPostQueue] =
        await Promise.all([
          createQueue({
            name: 'QR: Spam Accounts',
            subjectTypes: ['account'],
            reportTypes: [REASON_SPAM],
          }),
          createQueue({
            name: 'QR: Threat Accounts',
            subjectTypes: ['account'],
            reportTypes: [REASON_THREAT],
          }),
          createQueue({
            name: 'QR: Spam Posts',
            subjectTypes: ['record'],
            reportTypes: [REASON_SPAM],
            collection: 'app.bsky.feed.post',
          }),
        ])
      spamAccountQueueId = spamAccountQueue.id
      threatAccountQueueId = threatAccountQueue.id
      spamPostQueueId = spamPostQueue.id
    })

    afterAll(async () => {
      await Promise.all([
        deleteQueue(spamAccountQueueId).catch(() => {}),
        deleteQueue(threatAccountQueueId).catch(() => {}),
        deleteQueue(spamPostQueueId).catch(() => {}),
      ])
    })

    it('routes an account report to the matching queue', async () => {
      await reportAccount(sc.dids.bob, REASON_SPAM)

      const beforeRouting = new Date()
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await queryLatestReportForSubject(sc.dids.bob)
      expect(report).toBeDefined()
      expect(report.queue?.id).toBe(spamAccountQueueId)
      expect(new Date(report.queuedAt!).getTime()).toBeGreaterThanOrEqual(
        beforeRouting.getTime(),
      )
    })

    it('routes a record report to the matching queue with collection filter', async () => {
      const alicePost = sc.posts[sc.dids.alice][0]
      const postUri = alicePost.ref.uriStr
      const postCid = alicePost.ref.cidStr

      await reportRecord(postUri, postCid, REASON_SPAM)

      const beforeRouting = new Date()
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await queryLatestReportForSubject(postUri)
      expect(report).toBeDefined()
      expect(report.queue?.id).toBe(spamPostQueueId)
      expect(new Date(report.queuedAt!).getTime()).toBeGreaterThanOrEqual(
        beforeRouting.getTime(),
      )
    })

    it('routes a record report to a queue with null collection (matches all)', async () => {
      // Create a catch-all record queue with no collection filter
      const catchAllQueue = await createQueue({
        name: 'QR: All Records Threat',
        subjectTypes: ['record'],
        reportTypes: [REASON_THREAT],
      })

      // Use a different post than the collection-filter test to avoid subject overlap
      const bobPost = sc.posts[sc.dids.bob][0]
      const postUri = bobPost.ref.uriStr
      const postCid = bobPost.ref.cidStr

      await reportRecord(postUri, postCid, REASON_THREAT)
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await queryLatestReportForSubject(postUri)
      expect(report).toBeDefined()
      expect(report.queue?.id).toBe(catchAllQueue.id)

      // Clean up
      await deleteQueue(catchAllQueue.id)
    })

    it('sets queueId to -1 for reports with no matching queue', async () => {
      // REASON_MISLEADING has no configured queue
      await reportAccount(sc.dids.carol, REASON_MISLEADING)

      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await queryLatestReportForSubject(sc.dids.carol, 'open')
      expect(report).toBeDefined()
      expect(report.queue).toBeUndefined()
      expect(report.queuedAt).toBeUndefined()
    })

    it('skips unmatched reports (queueId = -1)', async () => {
      // The previous test already set carol's report to queueId = -1 (REASON_MISLEADING)
      const report = await queryLatestReportForSubject(sc.dids.carol, 'open')
      expect(report).toBeDefined()
      expect(report.queue).toBeUndefined() // queueId = -1

      // Run the routing again
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const reportAfter = await queryLatestReportForSubject(
        sc.dids.carol,
        'open',
      )
      expect(reportAfter.queue).toBeUndefined() // still unmatched, was skipped
      expect(reportAfter.id).toBe(report.id) // same report, unchanged
    })

    it('advances cursor so already-processed events are skipped on subsequent runs', async () => {
      await reportAccount(sc.dids.dan, REASON_THREAT)

      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await queryLatestReportForSubject(sc.dids.dan)
      expect(report).toBeDefined()
      expect(report.queue?.id).toBe(threatAccountQueueId)

      const cursorAfterFirst =
        await network.ozone.daemon.ctx.queueRouter.getCursor()
      expect(cursorAfterFirst).not.toBeNull()

      // Delete the report row to simulate an unprocessed state — there is no
      // API surface for this, so a direct DB write is necessary. The cursor
      // (which points at the moderation_event id) stays past this event, so
      // the daemon must not re-insert.
      await network.ozone.daemon.ctx.db.db
        .deleteFrom('report')
        .where('id', '=', report.id)
        .execute()

      // A second run must not reprocess the event because its id is below the cursor
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const reportAfterSecondRun = await queryLatestReportForSubject(
        sc.dids.dan,
      )
      // No report row should have been re-inserted
      expect(reportAfterSecondRun).toBeUndefined()

      // Cursor unchanged — second run found nothing past it
      const cursorAfterSecond =
        await network.ozone.daemon.ctx.queueRouter.getCursor()
      expect(cursorAfterSecond).toBe(cursorAfterFirst)
    })

    it('skips disabled queues when routing', async () => {
      // Disable the threat queue and create the report concurrently
      await Promise.all([
        agent.tools.ozone.queue.updateQueue(
          { queueId: threatAccountQueueId, enabled: false },
          {
            encoding: 'application/json',
            headers: await modHeaders(ids.ToolsOzoneQueueUpdateQueue),
          },
        ),
        reportAccount(sc.dids.alice, REASON_THREAT),
      ])

      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await queryLatestReportForSubject(sc.dids.alice, 'open')
      expect(report).toBeDefined()
      // Threat queue is disabled, so no match → queue is absent
      expect(report.queue).toBeUndefined()

      // Re-enable the queue for subsequent tests
      await agent.tools.ozone.queue.updateQueue(
        { queueId: threatAccountQueueId, enabled: true },
        {
          encoding: 'application/json',
          headers: await modHeaders(ids.ToolsOzoneQueueUpdateQueue),
        },
      )
    })
  })
})
