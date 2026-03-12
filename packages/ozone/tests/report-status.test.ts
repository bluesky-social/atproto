import AtpAgent, {
  ComAtprotoModerationDefs,
  ToolsOzoneReportAssignModerator,
  ToolsOzoneReportUnassignModerator,
} from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import {
  REASONMISLEADING,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'

describe('report-status', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient
  let agent: AtpAgent

  const bobsAccount = () => ({
    $type: 'com.atproto.admin.defs#repoRef' as const,
    did: sc.dids.bob,
  })

  const createReportOnBob = async (): Promise<number> => {
    await sc.createReport({
      reasonType: REASONSPAM,
      subject: bobsAccount(),
      reportedBy: sc.dids.alice,
    })
    await network.processAll()

    const reports = await modClient.queryReports({
      subject: sc.dids.bob,
      status: 'open',
      sortField: 'createdAt',
      sortDirection: 'desc',
      limit: 1,
    })
    return reports.reports[0].id
  }

  const getReportStatus = async (reportId: number): Promise<string> => {
    const reports = await modClient.queryReports({
      subject: sc.dids.bob,
    })
    const report = reports.reports.find((r) => r.id === reportId)
    return report!.status
  }

  const assignReport = async (
    input: ToolsOzoneReportAssignModerator.InputSchema,
  ) => {
    const { data } = await agent.tools.ozone.report.assignModerator(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportAssignModerator,
        'moderator',
      ),
    })
    return data
  }

  const unassignReport = async (
    input: ToolsOzoneReportUnassignModerator.InputSchema,
  ) => {
    const { data } = await agent.tools.ozone.report.unassignModerator(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportUnassignModerator,
        'moderator',
      ),
    })
    return data
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_status',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    agent = network.ozone.getClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('open -> assigned', async () => {
    const reportId = await createReportOnBob()
    await assignReport({ reportId })
    expect(await getReportStatus(reportId)).toBe('assigned')
  })

  it('open -> closed', async () => {
    const reportId = await createReportOnBob()
    await modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
      subject: bobsAccount(),
      reportAction: { ids: [reportId] },
    })
    expect(await getReportStatus(reportId)).toBe('closed')
  })

  it('open -> escalated', async () => {
    const reportId = await createReportOnBob()
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventEscalate',
        comment: 'Needs review',
      },
      subject: bobsAccount(),
      reportAction: { ids: [reportId] },
    })
    expect(await getReportStatus(reportId)).toBe('escalated')
  })

  it('assigned -> open', async () => {
    const reportId = await createReportOnBob()
    await assignReport({ reportId })
    expect(await getReportStatus(reportId)).toBe('assigned')

    await unassignReport({ reportId })
    expect(await getReportStatus(reportId)).toBe('open')
  })

  it('cannot transition to closed again (no-op)', async () => {
    const reportId = await createReportOnBob()

    // Close the report
    await modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
      subject: bobsAccount(),
      reportAction: { ids: [reportId] },
    })
    expect(await getReportStatus(reportId)).toBe('closed')

    // Acknowledge again - should remain closed (no-op transition)
    await modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
      subject: bobsAccount(),
      reportAction: { ids: [reportId] },
    })
    expect(await getReportStatus(reportId)).toBe('closed')
  })

  describe('mod event types', () => {
    it('takedown event closes a report', async () => {
      const reportId = await createReportOnBob()
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTakedown',
          comment: 'Takedown',
        },
        subject: bobsAccount(),
        reportAction: { ids: [reportId] },
      })
      expect(await getReportStatus(reportId)).toBe('closed')
    })
    it('label event closes a report', async () => {
      const reportId = await createReportOnBob()
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals: ['spam'],
          negateLabelVals: [],
        },
        subject: bobsAccount(),
        reportAction: { ids: [reportId] },
      })
      expect(await getReportStatus(reportId)).toBe('closed')
    })

    it('comment event closes a report', async () => {
      const reportId = await createReportOnBob()
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventComment',
          comment: 'Reviewed',
        },
        subject: bobsAccount(),
        reportAction: { ids: [reportId] },
      })
      expect(await getReportStatus(reportId)).toBe('closed')
    })

    it('report event does not change status when used with reportAction', async () => {
      const reportId = await createReportOnBob()

      // Create another report on the same subject - status of first should remain open
      await sc.createReport({
        reasonType: REASONMISLEADING,
        subject: bobsAccount(),
        reportedBy: sc.dids.carol,
      })
      await network.processAll()

      expect(await getReportStatus(reportId)).toBe('open')
    })
  })
})
