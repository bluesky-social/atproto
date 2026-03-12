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

  // Returns the most recent report for a subject using the queryReports API.
  // Pass a DID for account subjects or an at:// URI for record subjects.
  const queryLatestReportForSubject = async (subjectOrUri: string) => {
    const { reports } = await modClient.queryReports({
      subject: subjectOrUri,
    })
    return reports[0]
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_queue_router',
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

  it('skips routing and leaves cursor null when no queues are configured', async () => {
    // This test intentionally runs before any queues are created
    await reportAccount(sc.dids.alice, REASON_SPAM)

    await network.ozone.daemon.ctx.queueRouter.routeReports()

    // Cursor must stay null — early exit occurred before any DB writes
    const cursor = await network.ozone.daemon.ctx.queueRouter.getCursor()
    expect(cursor).toBeNull()

    // Report must remain unassigned (queue absent from API response when null)
    const report = await queryLatestReportForSubject(sc.dids.alice)
    expect(report).toBeDefined()
    expect(report.queue).toBeUndefined()
  })

  describe('with queues configured', () => {
    let spamAccountQueueId: number
    let harassmentAccountQueueId: number
    let spamPostQueueId: number

    beforeAll(async () => {
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
      await Promise.all([
        deleteQueue(spamAccountQueueId).catch(() => {}),
        deleteQueue(harassmentAccountQueueId).catch(() => {}),
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
        name: 'QR: All Records Harassment',
        subjectTypes: ['record'],
        reportTypes: [REASON_HARASSMENT],
      })

      // Use a different post than the collection-filter test to avoid subject overlap
      const bobPost = sc.posts[sc.dids.bob][0]
      const postUri = bobPost.ref.uriStr
      const postCid = bobPost.ref.cidStr

      await reportRecord(postUri, postCid, REASON_HARASSMENT)
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

      const report = await queryLatestReportForSubject(sc.dids.carol)
      expect(report).toBeDefined()
      expect(report.queue).toBeUndefined()
      expect(report.queuedAt).toBeUndefined()
    })

    it('skips unmatched reports (queueId = -1)', async () => {
      // The previous test already set carol's report to queueId = -1 (REASON_MISLEADING)
      const report = await queryLatestReportForSubject(sc.dids.carol)
      expect(report).toBeDefined()
      expect(report.queue).toBeUndefined() // queueId = -1

      // Run the routing again
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const reportAfter = await queryLatestReportForSubject(sc.dids.carol)
      expect(reportAfter.queue).toBeUndefined() // still unmatched, was skipped
      expect(reportAfter.id).toBe(report.id) // same report, unchanged
    })

    it('advances cursor so already-processed reports are skipped on subsequent runs', async () => {
      await reportAccount(sc.dids.dan, REASON_HARASSMENT)

      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await queryLatestReportForSubject(sc.dids.dan)
      expect(report).toBeDefined()
      expect(report.queue?.id).toBe(harassmentAccountQueueId)

      const cursorAfterFirst =
        await network.ozone.daemon.ctx.queueRouter.getCursor()
      expect(cursorAfterFirst).not.toBeNull()
      expect(cursorAfterFirst).toBeGreaterThanOrEqual(report.id)

      // Manually clear the queueId to simulate an unprocessed state —
      // there is no API surface for this, so a direct DB write is necessary
      await network.ozone.daemon.ctx.db.db
        .updateTable('report')
        .set({ queueId: null })
        .where('id', '=', report.id)
        .execute()

      // A second run must not reprocess the report because its id is below the cursor
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const reportAfterSecondRun = await queryLatestReportForSubject(
        sc.dids.dan,
      )
      expect(reportAfterSecondRun.queue).toBeUndefined()
    })

    it('skips disabled queues when routing', async () => {
      // Disable the harassment queue and create the report concurrently
      await Promise.all([
        agent.tools.ozone.queue.updateQueue(
          { queueId: harassmentAccountQueueId, enabled: false },
          {
            encoding: 'application/json',
            headers: await modHeaders(ids.ToolsOzoneQueueUpdateQueue),
          },
        ),
        reportAccount(sc.dids.alice, REASON_HARASSMENT),
      ])

      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await queryLatestReportForSubject(sc.dids.alice)
      expect(report).toBeDefined()
      // Harassment queue is disabled, so no match → queue is absent
      expect(report.queue).toBeUndefined()

      // Re-enable the queue for subsequent tests
      await agent.tools.ozone.queue.updateQueue(
        { queueId: harassmentAccountQueueId, enabled: true },
        {
          encoding: 'application/json',
          headers: await modHeaders(ids.ToolsOzoneQueueUpdateQueue),
        },
      )
    })
  })
})
