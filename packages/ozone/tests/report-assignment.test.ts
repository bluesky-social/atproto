import AtpAgent, {
  ToolsOzoneQueueAssignModerator,
  ToolsOzoneReportAssignModerator,
  ToolsOzoneReportGetAssignments,
} from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import { generateId } from './_util'

describe('report-assignment', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const assignReportModerator = async (
    input: ToolsOzoneReportAssignModerator.InputSchema,
    callerRole: 'admin' | 'moderator' | 'triage' = 'moderator',
  ) => {
    const { data } = await agent.tools.ozone.report.assignModerator(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportAssignModerator,
        callerRole,
      ),
    })
    return data
  }

  const assignQueueModerator = async (
    input: ToolsOzoneQueueAssignModerator.InputSchema,
    callerRole: 'admin' | 'moderator' | 'triage' = 'moderator',
  ) => {
    const { data } = await agent.tools.ozone.queue.assignModerator(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneQueueAssignModerator,
        callerRole,
      ),
    })
    return data
  }

  const getAssignments = async (
    input: ToolsOzoneReportGetAssignments.QueryParams,
    callerRole: 'admin' | 'moderator' | 'triage' = 'moderator',
  ) => {
    const { data } = await agent.tools.ozone.report.getAssignments(input, {
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportGetAssignments,
        callerRole,
      ),
    })
    return data
  }

  const clearAssignments = async () => {
    await network.ozone.ctx.db.db.deleteFrom('moderator_assignment').execute()
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'report_assignment',
    })
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    await clearAssignments()
  })

  afterAll(async () => {
    await network.close()
  })

  it('can get assignment history', async () => {
    const reportId = generateId()
    await assignReportModerator(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    const result = await getAssignments({ reportIds: [reportId] })
    expect(result.assignments.length).toBe(1)
  })

  it('moderator can assigned', async () => {
    const reportId = generateId()
    const assignment1 = await assignReportModerator(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    expect(assignment1.reportId).toBe(reportId)
    expect(assignment1.did).toBe(network.ozone.moderatorAccnt.did)
    expect(new Date(assignment1.endAt).getTime()).toBeGreaterThanOrEqual(
      new Date().getTime(),
    )
  })

  it('moderator can refresh assignment', async () => {
    const reportId = generateId()
    const assignment1 = await assignReportModerator(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    const assignment2 = await assignReportModerator(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    expect(assignment2.did).toBe(network.ozone.moderatorAccnt.did)
    expect(new Date(assignment2.endAt).getTime()).toBeGreaterThan(
      new Date(assignment1.endAt).getTime(),
    )
  })

  it('moderator can assign then un-assign a report', async () => {
    const reportId = generateId()
    await assignReportModerator(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    const assignment = await assignReportModerator(
      {
        reportId,
        assign: false,
      },
      'moderator',
    )
    expect(new Date(assignment.endAt).getTime()).toBeLessThanOrEqual(
      new Date().getTime(),
    )
  })

  it('assignment can be exchanged', async () => {
    const reportId = generateId()
    await assignReportModerator(
      {
        reportId,
        assign: true,
      },
      'admin',
    )
    await assignReportModerator(
      {
        reportId,
        assign: false,
      },
      'moderator',
    )
    const assignment = await assignReportModerator(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    expect(assignment.reportId).toBe(reportId)
    expect(assignment.did).toBe(network.ozone.moderatorAccnt.did)
    expect(new Date(assignment.endAt).getTime()).toBeGreaterThanOrEqual(
      new Date().getTime(),
    )
  })

  it('cannot double assign', async () => {
    const reportId = generateId()
    await assignReportModerator(
      {
        reportId,
        assign: true,
      },
      'moderator',
    )
    await expect(
      assignReportModerator(
        {
          reportId,
          assign: true,
        },
        'admin',
      ),
    ).rejects.toThrow('Report already assigned')
  })
})
