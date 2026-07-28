import type AtpAgent from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons.js'
import { REASONSPAM } from '../src/lexicon/types/com/atproto/moderation/defs.js'

describe('ozone-get-report', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

  const modHeaders = async (nsid: string) =>
    network.ozone.modHeaders(nsid, 'admin')

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_get_report',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  it('returns a single report by id', async () => {
    // Create a report on Alice's account
    await sc.createReport({
      reasonType: REASONSPAM,
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
      reportedBy: sc.dids.bob,
    })
    await network.processAll()

    // Fetch the report list to get the report ID
    const { data: list } = await agent.tools.ozone.report.queryReports(
      { status: 'open', subject: sc.dids.alice },
      { headers: await modHeaders(ids.ToolsOzoneReportQueryReports) },
    )
    expect(list.reports.length).toBeGreaterThan(0)
    const reportId = list.reports[0].id

    // Fetch the single report by ID
    const { data: report } = await agent.tools.ozone.report.getReport(
      { id: reportId },
      { headers: await modHeaders(ids.ToolsOzoneReportGetReport) },
    )

    expect(report.id).toBe(reportId)
    expect(report.subject.type).toBe('account')
    expect(report.subject.subject).toBe(sc.dids.alice)
    expect(report.reportType).toBe('com.atproto.moderation.defs#reasonSpam')
    expect(report.status).toBe('open')
  })

  it('returns a conversation report with a chat subject view', async () => {
    const convoId = 'get-report-convo-1'
    const convoUri = `at://${sc.dids.carol}/chat.bsky.convo/${convoId}`
    await sc.createReport({
      reasonType: REASONSPAM,
      subject: {
        $type: 'chat.bsky.convo.defs#convoRef',
        did: sc.dids.carol,
        convoId,
      },
      reportedBy: sc.dids.alice,
    })
    await network.processAll()

    const { data: list } = await agent.tools.ozone.report.queryReports(
      { status: 'open', subject: convoUri },
      { headers: await modHeaders(ids.ToolsOzoneReportQueryReports) },
    )
    expect(list.reports.length).toBe(1)

    const { data: report } = await agent.tools.ozone.report.getReport(
      { id: list.reports[0].id },
      { headers: await modHeaders(ids.ToolsOzoneReportGetReport) },
    )

    expect(report.subject.type).toBe('chat')
    expect(report.subject.subject).toBe(convoUri)
    // The conversation owner's account info is still hydrated for context
    expect(report.subject.repo).toBeDefined()
  })

  it('returns a message report with a chat subject view', async () => {
    const convoId = 'get-report-convo-2'
    const messageId = 'get-report-message-1'
    const messageUri = `at://${sc.dids.carol}/chat.bsky.convo.message/${messageId}`
    await sc.createReport({
      reasonType: REASONSPAM,
      subject: {
        $type: 'chat.bsky.convo.defs#messageRef',
        did: sc.dids.carol,
        convoId,
        messageId,
      },
      reportedBy: sc.dids.alice,
    })
    await network.processAll()

    const { data: list } = await agent.tools.ozone.report.queryReports(
      { status: 'open', subject: messageUri },
      { headers: await modHeaders(ids.ToolsOzoneReportQueryReports) },
    )
    expect(list.reports.length).toBe(1)

    const { data: report } = await agent.tools.ozone.report.getReport(
      { id: list.reports[0].id },
      { headers: await modHeaders(ids.ToolsOzoneReportGetReport) },
    )

    expect(report.subject.type).toBe('chat')
    expect(report.subject.subject).toBe(messageUri)
    // The message author's account info is still hydrated for context
    expect(report.subject.repo).toBeDefined()
  })

  it('hydrates actions for reports that have been actioned', async () => {
    const bobsAccount = {
      $type: 'com.atproto.admin.defs#repoRef' as const,
      did: sc.dids.bob,
    }

    await sc.createReport({
      reasonType: REASONSPAM,
      subject: bobsAccount,
      reportedBy: sc.dids.alice,
    })
    await network.processAll()

    const { data: list } = await agent.tools.ozone.report.queryReports(
      { status: 'open', subject: sc.dids.bob },
      { headers: await modHeaders(ids.ToolsOzoneReportQueryReports) },
    )
    const reportId = list.reports[0].id

    const event = await modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
      subject: bobsAccount,
      reportAction: {
        ids: [reportId],
        note: 'Reviewed',
      },
    })

    const { data: report } = await agent.tools.ozone.report.getReport(
      { id: reportId },
      { headers: await modHeaders(ids.ToolsOzoneReportGetReport) },
    )

    expect(report.status).toBe('closed')
    expect(report.actionEventIds).toEqual([event.id])
    expect(report.actions).toBeDefined()
    expect(report.actions).toHaveLength(1)
    expect(report.actions![0].id).toBe(event.id)
    expect(report.actions![0].event.$type).toBe(
      'tools.ozone.moderation.defs#modEventAcknowledge',
    )
  })

  it('omits actions when the report has not been actioned', async () => {
    await sc.createReport({
      reasonType: REASONSPAM,
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.carol,
      },
      reportedBy: sc.dids.alice,
    })
    await network.processAll()

    const { data: list } = await agent.tools.ozone.report.queryReports(
      { status: 'open', subject: sc.dids.carol },
      { headers: await modHeaders(ids.ToolsOzoneReportQueryReports) },
    )
    const reportId = list.reports[0].id

    const { data: report } = await agent.tools.ozone.report.getReport(
      { id: reportId },
      { headers: await modHeaders(ids.ToolsOzoneReportGetReport) },
    )

    expect(report.actionEventIds).toBeFalsy()
    expect(report.actions).toBeUndefined()
  })
})
