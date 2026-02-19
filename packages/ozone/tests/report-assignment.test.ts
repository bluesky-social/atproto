import AtpAgent, { ToolsOzoneReportClaimReport } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'

describe('report-assignment', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const claimReport = async (
    input: ToolsOzoneReportClaimReport.InputSchema,
    callerRole: 'admin' | 'moderator' | 'triage' = 'moderator',
  ) => {
    const { data } = await agent.tools.ozone.report.claimReport(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportClaimReport,
        callerRole,
      ),
    })
    return data
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'report_assignment',
    })
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    await network.ozone.ctx.db.db.deleteFrom('moderator_assignment').execute()
  })

  afterAll(async () => {
    await network.close()
  })

  it('moderator can claim', async () => {
    const assignment1 = await claimReport(
      {
        reportId: 1,
        assign: true,
      },
      'moderator',
    )
    expect(assignment1.reportId).toBe(1)
    expect(assignment1.did).toBe(network.ozone.moderatorAccnt.did)
    expect(new Date(assignment1.endAt).getTime()).toBeGreaterThanOrEqual(
      new Date().getTime(),
    )
  })

  it('moderator can refresh claim', async () => {
    const assignment1 = await claimReport(
      {
        reportId: 2,
        assign: true,
      },
      'moderator',
    )
    expect(assignment1.did).toBe(network.ozone.moderatorAccnt.did)

    const assignment2 = await claimReport(
      {
        reportId: 2,
        assign: true,
      },
      'moderator',
    )
    expect(assignment2.did).toBe(network.ozone.moderatorAccnt.did)
    expect(new Date(assignment2.endAt).getTime()).toBeGreaterThan(
      new Date(assignment1.endAt).getTime(),
    )
  })

  it('moderator can claim then un-claim a report', async () => {
    await claimReport(
      {
        reportId: 3,
        assign: true,
      },
      'moderator',
    )
    const assignment = await claimReport(
      {
        reportId: 3,
        assign: false,
      },
      'moderator',
    )
    expect(assignment.reportId).toBe(3)
    expect(assignment.did).toBe(network.ozone.moderatorAccnt.did)
    expect(new Date(assignment.endAt).getTime()).toBeLessThanOrEqual(
      new Date().getTime(),
    )
  })

  it('claim can be exchanged', async () => {
    await claimReport(
      {
        reportId: 4,
        assign: true,
      },
      'moderator',
    )
    await claimReport(
      {
        reportId: 4,
        assign: false,
      },
      'moderator',
    )
    const assignment = await claimReport(
      {
        reportId: 4,
        assign: true,
      },
      'admin',
    )
    expect(assignment.reportId).toBe(4)
    expect(assignment.did).toBe(network.ozone.adminAccnt.did)
    expect(new Date(assignment.endAt).getTime()).toBeGreaterThanOrEqual(new Date().getTime())
  })
})
