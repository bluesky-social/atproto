import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ids } from '@atproto/api'
import type AtpAgent from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { chat, com, tools } from '../src/lexicons/index.js'
import { RepoSubject } from '../src/mod-service/subject.js'

const REASON_SPAM = 'com.atproto.moderation.defs#reasonSpam'
const REASON_THREAT = 'tools.ozone.report.defs#reasonViolenceThreats'
const REASON_MISLEADING = 'com.atproto.moderation.defs#reasonMisleading'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('queue-router', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

  const modHeaders = (nsid: string) => network.ozone.modHeaders(nsid, 'admin')

  const createQueue = async (input: {
    name: string
    subjectTypes?: string[]
    reportTypes?: string[]
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
    return modClient.emitEvent({
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

  // Creates an account-level report event the way automated tooling will
  const createAutomatedReport = async (
    did: string,
    reportType: string,
    queueId: number,
  ) => {
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReport',
        reportType,
        comment: 'automated test report',
      },
      subject: { $type: 'com.atproto.admin.defs#repoRef', did },
      modTool: {
        name: 'automated-tool',
        meta: { isAutomated: true, queueId },
      },
    })
  }

  // Creates a conversation-level report event via modClient
  const reportConvo = async (
    did: string,
    convoId: string,
    reportType: string,
  ) => {
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReport',
        reportType,
        comment: 'automated test report',
      },
      subject: { $type: 'chat.bsky.convo.defs#convoRef', did, convoId },
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
    await network.ozone.daemon.ctx.queueRouter.destroy()
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  it('marks pending reports unmatched when no queues are configured', async () => {
    const event = await reportAccount(sc.dids.alice, REASON_SPAM)

    await network.ozone.daemon.ctx.queueRouter.routeReports()

    // Cursor advances past the processed event
    const cursor = await network.ozone.daemon.ctx.queueRouter.getCursor()
    expect(cursor).not.toBeNull()
    expect(cursor!).toBeGreaterThan(0)

    // Report row exists with no queue (queueId = -1 surfaces as undefined)
    const report = await queryLatestReportForSubject(sc.dids.alice, 'open')
    expect(report).toBeDefined()
    expect(report.queue).toBeUndefined()

    const db = network.ozone.ctx.db.db
    const storedReport = await db
      .selectFrom('report')
      .where('eventId', '=', event.id)
      .select(['id', 'reporterDid', 'updatedAt', 'status', 'queueId'])
      .executeTakeFirstOrThrow()
    const sourceEvent = await db
      .selectFrom('moderation_event')
      .where('id', '=', event.id)
      .select('createdBy')
      .executeTakeFirstOrThrow()
    expect(storedReport.reporterDid).toBe(sourceEvent.createdBy)

    // Retrying ingestion repairs a legacy NULL owner without changing report
    // state or timestamps.
    await db
      .updateTable('report')
      .set({ reporterDid: null })
      .where('id', '=', storedReport.id)
      .execute()
    await network.ozone.ctx.db.transaction((txn) =>
      network.ozone.ctx
        .queueService(txn)
        .insertReportsFromEvents({ cursor: event.id - 1, limit: 1 }),
    )
    const repaired = await db
      .selectFrom('report')
      .where('id', '=', storedReport.id)
      .select(['reporterDid', 'updatedAt', 'status', 'queueId'])
      .executeTakeFirstOrThrow()
    expect(repaired).toEqual({
      reporterDid: sourceEvent.createdBy,
      updatedAt: storedReport.updatedAt,
      status: storedReport.status,
      queueId: storedReport.queueId,
    })

    // A retry never transfers an already populated owner.
    await db
      .updateTable('report')
      .set({ reporterDid: sc.dids.bob })
      .where('id', '=', storedReport.id)
      .execute()
    await network.ozone.ctx.db.transaction((txn) =>
      network.ozone.ctx
        .queueService(txn)
        .insertReportsFromEvents({ cursor: event.id - 1, limit: 1 }),
    )
    const preserved = await db
      .selectFrom('report')
      .where('id', '=', storedReport.id)
      .select(['reporterDid', 'updatedAt', 'status', 'queueId'])
      .executeTakeFirstOrThrow()
    expect(preserved).toEqual({
      reporterDid: sc.dids.bob,
      updatedAt: storedReport.updatedAt,
      status: storedReport.status,
      queueId: storedReport.queueId,
    })
  })

  it.each(['account', 'record', 'message', 'conversation'] as const)(
    'creates a pending %s report before emitEvent returns',
    async (subjectType) => {
      const subject =
        subjectType === 'account'
          ? com.atproto.admin.defs.repoRef.$build({ did: sc.dids.alice })
          : subjectType === 'record'
            ? com.atproto.repo.strongRef.$build({
                uri: sc.posts[sc.dids.alice][0].ref.uriStr,
                cid: sc.posts[sc.dids.alice][0].ref.cidStr,
              })
            : subjectType === 'message'
              ? chat.bsky.convo.defs.messageRef.$build({
                  did: sc.dids.alice,
                  messageId: 'pending-message',
                  convoId: 'pending-conversation',
                })
              : chat.bsky.convo.defs.convoRef.$build({
                  did: sc.dids.alice,
                  convoId: 'pending-conversation',
                })
      const event = await modClient.emitEvent({
        subject,
        event: tools.ozone.moderation.defs.modEventReport.$build({
          reportType: REASON_SPAM,
        }),
        modTool: { name: 'report-test', meta: { isAutomated: true } },
      })
      const { reports } = await modClient.queryReports({ status: 'open' })
      const report = reports.find((r) => r.eventId === event.id)
      expect(report).toMatchObject({
        status: 'open',
        reportType: REASON_SPAM,
        reportedBy: event.createdBy,
        isAutomated: true,
        createdAt: event.createdAt,
      })
      expect(report?.queue).toBeUndefined()
      expect(report?.queuedAt).toBeUndefined()
      const { data } = await agent.tools.ozone.report.listActivities(
        { reportId: report!.id },
        { headers: await modHeaders(tools.ozone.report.listActivities.$lxm) },
      )
      expect(data.activities).toEqual([])
      await network.ozone.daemon.ctx.queueRouter.routeReports()
    },
  )

  it('creates a pending report before createReport returns', async () => {
    const event = await sc.createReport({
      reasonType: REASON_SPAM,
      reportedBy: sc.dids.bob,
      subject: com.atproto.admin.defs.repoRef.$build({ did: sc.dids.alice }),
    })
    const { reports } = await modClient.queryReports({ status: 'open' })
    expect(reports.find((r) => r.eventId === event.id)).toMatchObject({
      status: 'open',
      reportedBy: sc.dids.bob,
      createdAt: event.createdAt,
    })
    await network.ozone.daemon.ctx.queueRouter.routeReports()
  })

  it('creates the report row in the source event transaction and rolls both back', async () => {
    const db = network.ozone.ctx.db
    let eventId = 0
    await expect(
      db.transaction(async (txn) => {
        const { event } = await network.ozone.ctx.modService(txn).report({
          reasonType: REASON_SPAM,
          reportedBy: sc.dids.bob,
          subject: new RepoSubject(sc.dids.alice),
        })
        eventId = event.id
        const pending = await txn.db
          .selectFrom('report')
          .select(['status', 'queueId'])
          .where('eventId', '=', event.id)
          .executeTakeFirstOrThrow()
        expect(pending).toEqual({ status: 'open', queueId: null })
        throw new Error('abort report transaction')
      }),
    ).rejects.toThrow('abort report transaction')
    expect(
      await db.db
        .selectFrom('report')
        .select('id')
        .where('eventId', '=', eventId)
        .execute(),
    ).toEqual([])
    expect(
      await db.db
        .selectFrom('moderation_event')
        .select('id')
        .where('id', '=', eventId)
        .execute(),
    ).toEqual([])
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

    it('inserts and routes a missing report row from an event-only writer', async () => {
      const event = await reportAccount(sc.dids.bob, REASON_SPAM)
      // @NOTE Simulate an older writer that committed only the moderation event.
      await network.ozone.ctx.db.db
        .deleteFrom('report')
        .where('eventId', '=', event.id)
        .execute()
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      const report = await queryLatestReportForSubject(sc.dids.bob)
      expect(report.eventId).toBe(event.id)
      expect(report.queue?.id).toBe(spamAccountQueueId)
      expect(report.createdAt).toBe(event.createdAt)
    })

    it('routes pending reports even when the event cursor has already passed them', async () => {
      const event = await reportAccount(sc.dids.bob, REASON_SPAM)
      await network.ozone.ctx.db.db
        .updateTable('job_cursor')
        .set({ cursor: String(event.id) })
        .where('job', '=', 'queue_router')
        .execute()
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      const report = await queryLatestReportForSubject(sc.dids.bob)
      expect(report.eventId).toBe(event.id)
      expect(report.queue?.id).toBe(spamAccountQueueId)
    })

    it('routes a report that commits after a later event has been processed', async () => {
      const ready = deferred<number>()
      const release = deferred<void>()
      const db = network.ozone.ctx.db
      const writing = db.transaction(async (txn) => {
        const { event } = await network.ozone.ctx.modService(txn).report({
          subject: new RepoSubject(sc.dids.alice),
          reasonType: REASON_SPAM,
          reportedBy: sc.dids.bob,
        })
        ready.resolve(event.id)
        await release.promise
      })
      // @NOTE Surface transaction failures without leaving the test waiting on its gate.
      writing.catch(ready.reject)
      const router = network.ozone.daemon.ctx.queueRouter
      let eventId: number
      try {
        eventId = await ready.promise
        const later = await reportAccount(sc.dids.bob, REASON_SPAM)
        await router.routeReports()
        expect(await router.getCursor()).toBe(later.id)
        expect((await queryLatestReportForSubject(sc.dids.bob)).eventId).toBe(
          later.id,
        )
      } finally {
        release.resolve()
        await writing
      }
      await router.routeReports()
      const report = await queryLatestReportForSubject(sc.dids.alice)
      expect(report.eventId).toBe(eventId)
      expect(report.queue?.id).toBe(spamAccountQueueId)
    })

    it('routes at most 100 pending reports per pass', async () => {
      const eventIds: number[] = []
      const db = network.ozone.ctx.db
      await db.transaction(async (txn) => {
        const service = network.ozone.ctx.modService(txn)
        for (let i = 0; i < 101; i++) {
          const { event } = await service.report({
            subject: new RepoSubject(sc.dids.bob),
            reasonType: REASON_SPAM,
            reportedBy: sc.dids.alice,
          })
          eventIds.push(event.id)
        }
      })
      const pending = () =>
        db.db
          .selectFrom('report')
          .select('eventId')
          .where('eventId', 'in', eventIds)
          .where('queueId', 'is', null)
          .execute()
      const router = network.ozone.daemon.ctx.queueRouter
      await router.routeReports()
      expect(await pending()).toHaveLength(1)
      await router.routeReports()
      expect(await pending()).toEqual([])
    })

    it.each(['closure first', 'routing first', 'concurrently'])(
      'preserves closure and assigns a queue when actioning and routing run %s',
      async (order) => {
        const event = await reportAccount(sc.dids.bob, REASON_SPAM)
        const pending = await queryLatestReportForSubject(sc.dids.bob, 'open')
        const close = () =>
          modClient.emitEvent({
            subject: com.atproto.admin.defs.repoRef.$build({
              did: sc.dids.bob,
            }),
            event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
            reportAction: { ids: [pending.id] },
          })
        const route = () => network.ozone.daemon.ctx.queueRouter.routeReports()
        let action: Awaited<ReturnType<typeof close>>
        if (order === 'closure first') {
          action = await close()
          const closed = await network.ozone.ctx.db.db
            .selectFrom('report')
            .select(['closedAt', 'actionEventIds'])
            .where('id', '=', pending.id)
            .executeTakeFirstOrThrow()
          await route()
          expect(
            await network.ozone.ctx.db.db
              .selectFrom('report')
              .select(['closedAt', 'actionEventIds'])
              .where('id', '=', pending.id)
              .executeTakeFirstOrThrow(),
          ).toEqual(closed)
        } else if (order === 'routing first') {
          await route()
          action = await close()
        } else {
          ;[action] = await Promise.all([close(), route()])
        }
        const report = await queryLatestReportForSubject(sc.dids.bob, 'closed')
        expect(report.eventId).toBe(event.id)
        expect(report.status).toBe('closed')
        expect(report.queue?.id).toBe(spamAccountQueueId)
        expect(report.actionEventIds).toEqual([action.id])
        const before = report
        await route()
        expect(
          await queryLatestReportForSubject(sc.dids.bob, 'closed'),
        ).toEqual(before)
      },
    )

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

    it('routes an automated report to the queue named in modTool.meta.queueId', async () => {
      await createAutomatedReport(sc.dids.dan, REASON_SPAM, spamPostQueueId)

      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await queryLatestReportForSubject(sc.dids.dan)
      expect(report).toBeDefined()
      expect(report.queue?.id).toBe(spamPostQueueId)
      expect(report.isAutomated).toBe(true)
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

    it('routes a conversation report to the matching conversation queue', async () => {
      const convoQueue = await createQueue({
        name: 'QR: Spam Convos',
        subjectTypes: ['conversation'],
        reportTypes: [REASON_SPAM],
      })

      await reportConvo(sc.dids.carol, 'qr-convo-spam-1', REASON_SPAM)

      const beforeRouting = new Date()
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const { reports } = await modClient.queryReports({
        status: 'queued',
        subjectType: 'conversation',
      })
      const report = reports[0]
      expect(report).toBeDefined()
      expect(report.queue?.id).toBe(convoQueue.id)
      expect(new Date(report.queuedAt!).getTime()).toBeGreaterThanOrEqual(
        beforeRouting.getTime(),
      )

      await deleteQueue(convoQueue.id)
    })

    it('does not route a conversation report to an account queue', async () => {
      // Only the account-level threat queue accepts REASON_THREAT — a
      // conversation report with the same reason must stay unmatched.
      await reportConvo(sc.dids.carol, 'qr-convo-threat-1', REASON_THREAT)

      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const { reports } = await modClient.queryReports({
        status: 'open',
        subjectType: 'conversation',
      })
      const report = reports[0]
      expect(report).toBeDefined()
      expect(report.queue).toBeUndefined()
      expect(report.queuedAt).toBeUndefined()
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

  describe('custom queues', () => {
    let customQueueId: number

    beforeAll(async () => {
      // A queue with no subjectTypes/reportTypes is never attribute-matched,
      // so it only receives reports routed explicitly via modTool.meta.queueId.
      const customQueue = await createQueue({ name: 'QR: Automation Only' })
      customQueueId = customQueue.id
    })

    afterAll(async () => {
      await deleteQueue(customQueueId).catch(() => {})
    })

    it('creates a queue with empty subjectTypes and reportTypes', async () => {
      const { queues } = (
        await agent.tools.ozone.queue.listQueues(
          {},
          { headers: await modHeaders(ids.ToolsOzoneQueueListQueues) },
        )
      ).data
      const customQueue = queues.find((q) => q.id === customQueueId)
      expect(customQueue).toBeDefined()
      expect(customQueue!.subjectTypes ?? []).toEqual([])
      expect(customQueue!.reportTypes ?? []).toEqual([])
    })

    it('routes an automated report into it via modTool.meta.queueId', async () => {
      await createAutomatedReport(sc.dids.bob, REASON_SPAM, customQueueId)

      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await queryLatestReportForSubject(sc.dids.bob)
      expect(report).toBeDefined()
      expect(report.queue?.id).toBe(customQueueId)
      expect(report.isAutomated).toBe(true)
    })

    it('never attribute-matches an organic report into it', async () => {
      // No other queue matches REASON_SPAM accounts, so
      // a plain (non-automated) report must land unrouted rather than in the
      // custom queue.
      await reportAccount(sc.dids.carol, REASON_SPAM)

      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const report = await queryLatestReportForSubject(sc.dids.carol, 'open')
      expect(report).toBeDefined()
      expect(report.queue).toBeUndefined()
      expect(report.isAutomated).toBe(false)
    })

    it('supports multiple custom queues, routing each report to its named queue', async () => {
      // Two more queues with no matching criteria coexist (checkConflict
      // ignores empty criteria) alongside the one from beforeAll.
      const [queueA, queueB] = await Promise.all([
        createQueue({ name: 'QR: Custom Queue A' }),
        createQueue({ name: 'QR: Custom Queue B' }),
      ])
      expect(queueA.id).not.toBe(queueB.id)

      // Same report type for both — only the explicit queueId distinguishes
      // them, proving routing keys off modTool.meta.queueId.
      await createAutomatedReport(sc.dids.dan, REASON_SPAM, queueA.id)
      await createAutomatedReport(sc.dids.carol, REASON_SPAM, queueB.id)

      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const reportA = await queryLatestReportForSubject(sc.dids.dan)
      expect(reportA).toBeDefined()
      expect(reportA.queue?.id).toBe(queueA.id)
      expect(reportA.isAutomated).toBe(true)

      const reportB = await queryLatestReportForSubject(sc.dids.carol)
      expect(reportB).toBeDefined()
      expect(reportB.queue?.id).toBe(queueB.id)
      expect(reportB.isAutomated).toBe(true)

      await Promise.all([
        deleteQueue(queueA.id).catch(() => {}),
        deleteQueue(queueB.id).catch(() => {}),
      ])
    })
  })
})
