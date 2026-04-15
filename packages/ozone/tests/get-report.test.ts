import AtpAgent from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import { REASONSPAM } from '../src/lexicon/types/com/atproto/moderation/defs'

describe('ozone-get-report', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const modHeaders = async (nsid: string) =>
    network.ozone.modHeaders(nsid, 'admin')

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_get_report',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
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
      { subject: sc.dids.alice },
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
})
