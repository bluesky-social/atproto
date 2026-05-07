import AtpAgent from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import { REASONSPAM } from '../src/lexicon/types/com/atproto/moderation/defs'

const DEFS = 'tools.ozone.report.defs'

describe('report-reassign-queue', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // Track queue IDs created during each test so afterEach can soft-delete them.
  // Soft-deleted queues are filtered out of `checkConflict`, so tests are free
  // to reuse the same queue configuration without tripping ConflictingQueue.
  const createdQueueIds: number[] = []

  const modHeaders = async (
    nsid: string,
    role: 'admin' | 'moderator' | 'triage' = 'admin',
  ) => network.ozone.modHeaders(nsid, role)

  const createReport = async (subjectDid: string) => {
    await sc.createReport({
      reasonType: REASONSPAM,
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: subjectDid,
      },
      reportedBy: sc.dids.bob,
    })
    await network.processAll()

    const { data } = await agent.tools.ozone.report.queryReports(
      { subject: subjectDid },
      { headers: await modHeaders(ids.ToolsOzoneReportQueryReports) },
    )
    const report = data.reports[0]
    if (!report) throw new Error(`No report found for subject ${subjectDid}`)
    return report
  }

  const createQueue = async (
    overrides: {
      name?: string
      subjectTypes?: string[]
      reportTypes?: string[]
    } = {},
  ) => {
    const name = overrides.name ?? `q-${Date.now()}-${Math.random()}`
    const input = {
      name,
      subjectTypes: overrides.subjectTypes ?? ['account'],
      reportTypes: overrides.reportTypes ?? [
        'com.atproto.moderation.defs#reasonSpam',
      ],
    }
    const { data } = await agent.tools.ozone.queue.createQueue(input, {
      encoding: 'application/json',
      headers: await modHeaders(ids.ToolsOzoneQueueCreateQueue),
    })
    createdQueueIds.push(data.queue.id)
    return data
  }

  const deleteQueue = async (queueId: number) =>
    agent.tools.ozone.queue.deleteQueue(
      { queueId },
      {
        encoding: 'application/json',
        headers: await modHeaders(ids.ToolsOzoneQueueDeleteQueue),
      },
    )

  const closeReport = async (reportId: number) => {
    await agent.tools.ozone.report.createActivity(
      {
        reportId,
        activity: { $type: `${DEFS}#closeActivity` },
      },
      {
        encoding: 'application/json',
        headers: await modHeaders(ids.ToolsOzoneReportCreateActivity),
      },
    )
  }

  const disableQueue = async (queueId: number) => {
    return agent.tools.ozone.queue.updateQueue(
      { queueId, enabled: false },
      {
        encoding: 'application/json',
        headers: await modHeaders(ids.ToolsOzoneQueueUpdateQueue),
      },
    )
  }

  const escalateReport = async (reportId: number) => {
    await agent.tools.ozone.report.createActivity(
      {
        reportId,
        activity: { $type: `${DEFS}#escalationActivity` },
      },
      {
        encoding: 'application/json',
        headers: await modHeaders(ids.ToolsOzoneReportCreateActivity),
      },
    )
  }

  const reassignQueue = async (
    input: { reportId: number; queueId: number; comment?: string },
    role: 'admin' | 'moderator' | 'triage' = 'admin',
  ) => {
    return agent.tools.ozone.report.reassignQueue(input, {
      encoding: 'application/json',
      headers: await modHeaders(ids.ToolsOzoneReportReassignQueue, role),
    })
  }

  const listActivities = async (reportId: number) => {
    const { data } = await agent.tools.ozone.report.listActivities(
      { reportId },
      { headers: await modHeaders(ids.ToolsOzoneReportListActivities) },
    )
    return data
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_reassign_queue',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterEach(async () => {
    await Promise.all(
      createdQueueIds.splice(0).map((id) => deleteQueue(id).catch(() => {})),
    )
  })

  afterAll(async () => {
    await network.close()
  })

  describe('happy path: assigning to a real queue', () => {
    it('transitions open → queued and writes an activity row', async () => {
      const report = await createReport(sc.dids.alice)
      const queue = await createQueue()

      const { data } = await reassignQueue({
        reportId: report.id,
        queueId: queue.queue.id,
        comment: 'Routing to spam queue for review',
      })

      expect(data.report.id).toBe(report.id)
      expect(data.report.status).toBe('queued')
      expect(data.report.queue?.id).toBe(queue.queue.id)
      expect(data.report.queuedAt).toBeDefined()

      const activities = await listActivities(report.id)
      const queueActivity = activities.activities.find(
        (a) => a.activity.$type === `${DEFS}#queueActivity`,
      )
      expect(queueActivity).toBeDefined()
      expect(queueActivity!.internalNote).toBe(
        'Routing to spam queue for review',
      )
      expect(queueActivity!.publicNote).toBeUndefined()
      expect(queueActivity!.isAutomated).toBe(false)
      expect((queueActivity!.activity as any).previousStatus).toBe('open')
      expect(queueActivity!.meta).toEqual({
        fromQueueId: null,
        toQueueId: queue.queue.id,
      })
    })
  })

  describe('queue-to-queue reassignment', () => {
    it('keeps status queued and records fromQueueId correctly', async () => {
      const report = await createReport(sc.dids.carol)
      const queueA = await createQueue()
      // Second queue needs a distinct config to avoid ConflictingQueue.
      const queueB = await createQueue({
        reportTypes: ['com.atproto.moderation.defs#reasonViolation'],
      })

      await reassignQueue({ reportId: report.id, queueId: queueA.queue.id })

      const { data } = await reassignQueue({
        reportId: report.id,
        queueId: queueB.queue.id,
      })

      expect(data.report.status).toBe('queued')
      expect(data.report.queue?.id).toBe(queueB.queue.id)

      const activities = await listActivities(report.id)
      const queueActivities = activities.activities.filter(
        (a) => a.activity.$type === `${DEFS}#queueActivity`,
      )
      // Sorted DESC, so [0] is the most recent.
      expect(queueActivities.length).toBeGreaterThanOrEqual(2)
      expect((queueActivities[0].activity as any).previousStatus).toBe('queued')
      expect(queueActivities[0].meta).toEqual({
        fromQueueId: queueA.queue.id,
        toQueueId: queueB.queue.id,
      })
    })
  })

  describe('unassignment (queueId = -1)', () => {
    it('transitions queued → open and clears queuedAt', async () => {
      const report = await createReport(sc.dids.dan)
      const queue = await createQueue()

      await reassignQueue({ reportId: report.id, queueId: queue.queue.id })

      const { data } = await reassignQueue({
        reportId: report.id,
        queueId: -1,
      })

      expect(data.report.status).toBe('open')
      expect(data.report.queue).toBeUndefined()
      expect(data.report.queuedAt).toBeUndefined()

      const activities = await listActivities(report.id)
      const latest = activities.activities[0]
      expect(latest.activity.$type).toBe(`${DEFS}#queueActivity`)
      expect((latest.activity as any).previousStatus).toBe('queued')
      expect(latest.meta).toEqual({
        fromQueueId: queue.queue.id,
        toQueueId: -1,
      })
    })
  })

  describe('errors', () => {
    it('throws ReportClosed when report is closed', async () => {
      const report = await createReport(sc.dids.alice)
      await closeReport(report.id)
      const queue = await createQueue()

      await expect(
        reassignQueue({ reportId: report.id, queueId: queue.queue.id }),
      ).rejects.toThrow(/ReportClosed|closed/)
    })

    it('throws AlreadyInTargetQueue when target equals current queue', async () => {
      const report = await createReport(sc.dids.alice)
      const queue = await createQueue()
      await reassignQueue({ reportId: report.id, queueId: queue.queue.id })

      await expect(
        reassignQueue({ reportId: report.id, queueId: queue.queue.id }),
      ).rejects.toThrow(/AlreadyInTargetQueue|already/)
    })

    it('throws AlreadyInTargetQueue when unassigning a never-queued report', async () => {
      const report = await createReport(sc.dids.alice)

      await expect(
        reassignQueue({ reportId: report.id, queueId: -1 }),
      ).rejects.toThrow(/AlreadyInTargetQueue|already/)
    })

    it('throws QueueNotFound when target queue does not exist', async () => {
      const report = await createReport(sc.dids.alice)

      await expect(
        reassignQueue({ reportId: report.id, queueId: 999999 }),
      ).rejects.toThrow(/QueueNotFound|not found/)
    })

    it('throws QueueNotFound when target queue is soft-deleted', async () => {
      const report = await createReport(sc.dids.alice)
      const queue = await createQueue()
      await deleteQueue(queue.queue.id)

      await expect(
        reassignQueue({ reportId: report.id, queueId: queue.queue.id }),
      ).rejects.toThrow(/QueueNotFound|not found/)
    })

    it('throws QueueDisabled when target queue is disabled', async () => {
      const report = await createReport(sc.dids.alice)
      const queue = await createQueue()
      await disableQueue(queue.queue.id)

      await expect(
        reassignQueue({ reportId: report.id, queueId: queue.queue.id }),
      ).rejects.toThrow(/QueueDisabled|disabled/)
    })

    it('throws ReportNotFound when report does not exist', async () => {
      const queue = await createQueue()

      await expect(
        reassignQueue({ reportId: 999999, queueId: queue.queue.id }),
      ).rejects.toThrow(/ReportNotFound|not found/)
    })
  })

  describe('status-preserving cases', () => {
    it('keeps escalated status when reassigning an escalated report', async () => {
      const report = await createReport(sc.dids.alice)
      await escalateReport(report.id)
      const queue = await createQueue()

      const { data } = await reassignQueue({
        reportId: report.id,
        queueId: queue.queue.id,
      })

      expect(data.report.status).toBe('escalated')
      expect(data.report.queue?.id).toBe(queue.queue.id)

      const activities = await listActivities(report.id)
      const latest = activities.activities[0]
      expect(latest.activity.$type).toBe(`${DEFS}#queueActivity`)
      expect((latest.activity as any).previousStatus).toBe('escalated')
    })
  })

  describe('auth', () => {
    it('allows triage role to reassign', async () => {
      const report = await createReport(sc.dids.alice)
      const queue = await createQueue()

      const { data } = await reassignQueue(
        { reportId: report.id, queueId: queue.queue.id },
        'triage',
      )

      expect(data.report.status).toBe('queued')
    })
  })
})
