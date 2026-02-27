import AtpAgent, {
  ToolsOzoneQueueAssignModerator,
  ToolsOzoneReportAssignModerator,
  ToolsOzoneReportGetAssignments,
} from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'

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

  const clearQueues = async () => {
    await network.ozone.ctx.db.db.deleteFrom('report_queue').execute()
  }
  const clearAssignments = async () => {
    await network.ozone.ctx.db.db.deleteFrom('moderator_assignment').execute()
  }

  const createQueue = async (name: string, reportTypes: string[]) => {
    const { data } = await agent.tools.ozone.queue.createQueue(
      {
        name,
        subjectTypes: ['account'],
        reportTypes,
      },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneQueueCreateQueue,
          'admin',
        ),
      },
    )
    return data
  }

  let queueId: number

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'report_assignment',
    })
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    await clearAssignments()
    await clearQueues()

    const queue = await createQueue('Report Queue', [
      'com.atproto.moderation.defs#reasonSpam',
    ])
    queueId = queue.queue.id
  })

  afterAll(async () => {
    await network.close()
  })

  it('can get assignment history', async () => {
    const reportId = 1001
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
    const reportId = 1002
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
    const reportId = 1003
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
    const reportId = 1004
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
    const reportId = 1005
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

  describe('pagination', () => {
    it('paginates assignments with limit', async () => {
      await clearAssignments()
      await assignReportModerator({ reportId: 2001, assign: true }, 'admin')
      await assignReportModerator({ reportId: 2002, assign: true }, 'admin')
      await assignReportModerator({ reportId: 2003, assign: true }, 'admin')

      const firstPage = await getAssignments({ limit: 2 })
      expect(firstPage.assignments.length).toBe(2)
      expect(firstPage.cursor).toBeDefined()
    })

    it('returns all results when limit exceeds total', async () => {
      await clearAssignments()
      await assignReportModerator({ reportId: 2101, assign: true }, 'admin')
      await assignReportModerator({ reportId: 2102, assign: true }, 'admin')

      const result = await getAssignments({ limit: 50 })
      expect(result.assignments.length).toBe(2)
      expect(result.cursor).toBeDefined()
    })

    it('fetches next page using cursor', async () => {
      await clearAssignments()
      await assignReportModerator({ reportId: 2201, assign: true }, 'admin')
      await assignReportModerator({ reportId: 2202, assign: true }, 'admin')
      await assignReportModerator({ reportId: 2203, assign: true }, 'admin')

      const firstPage = await getAssignments({ limit: 2 })
      expect(firstPage.assignments.length).toBe(2)
      expect(firstPage.cursor).toBeDefined()

      const secondPage = await getAssignments({
        limit: 2,
        cursor: firstPage.cursor,
      })
      expect(secondPage.assignments.length).toBe(1)
      expect(secondPage.cursor).toBeDefined()

      // Ensure no overlap between pages
      const firstPageIds = firstPage.assignments.map((a) => a.id)
      const secondPageIds = secondPage.assignments.map((a) => a.id)
      for (const id of secondPageIds) {
        expect(firstPageIds).not.toContain(id)
      }
    })

    it('returns all assignments across pages', async () => {
      await clearAssignments()
      await assignReportModerator({ reportId: 2301, assign: true }, 'admin')
      await assignReportModerator({ reportId: 2302, assign: true }, 'admin')
      await assignReportModerator({ reportId: 2303, assign: true }, 'admin')

      // Collect all assignments via pagination
      const allAssignments: typeof firstPage.assignments = []
      let cursor: string | undefined
      const firstPage = await getAssignments({ limit: 1 })
      allAssignments.push(...firstPage.assignments)
      cursor = firstPage.cursor

      while (cursor) {
        const page = await getAssignments({ limit: 1, cursor })
        allAssignments.push(...page.assignments)
        cursor = page.cursor
      }

      expect(allAssignments.length).toBe(3)
      // Verify all unique
      const ids = allAssignments.map((a) => a.id)
      expect(new Set(ids).size).toBe(3)
    })

    it('applies filters alongside pagination', async () => {
      await clearAssignments()
      const reportId1 = 2401
      const reportId2 = 2402
      const reportId3 = 2403
      await assignReportModerator(
        { reportId: reportId1, assign: true },
        'admin',
      )
      await assignReportModerator(
        { reportId: reportId2, assign: true },
        'admin',
      )
      await assignReportModerator(
        { reportId: reportId3, assign: true },
        'moderator',
      )

      const result = await getAssignments({
        dids: [network.ozone.adminAccnt.did],
        limit: 1,
      })
      expect(result.assignments.length).toBe(1)
      expect(result.assignments[0].did).toBe(network.ozone.adminAccnt.did)
      expect(result.cursor).toBeDefined()

      const nextPage = await getAssignments({
        dids: [network.ozone.adminAccnt.did],
        limit: 1,
        cursor: result.cursor,
      })
      expect(nextPage.assignments.length).toBe(1)
      expect(nextPage.assignments[0].did).toBe(network.ozone.adminAccnt.did)
    })
  })

  it('hydrates queueView when queueId is provided', async () => {
    const reportId = 3001
    const assignment = await assignReportModerator(
      {
        reportId,
        queueId,
        assign: true,
      },
      'admin',
    )
    expect(assignment.reportId).toBe(reportId)
    expect(assignment.queueView).toBeDefined()
    expect(assignment.queueView!.id).toBe(queueId)
    expect(assignment.queueView!.name).toBe('Report Queue')
    expect(assignment.queueView!.subjectTypes).toEqual(['account'])
  })

  it('omits queueView when no queueId is provided', async () => {
    const reportId = 3002
    const assignment = await assignReportModerator(
      {
        reportId,
        assign: true,
      },
      'admin',
    )
    expect(assignment.reportId).toBe(reportId)
    expect(assignment.queueView).toBeUndefined()
  })

  it('hydrates queueView in getAssignments', async () => {
    await clearAssignments()
    const reportId = 3003
    await assignReportModerator({ reportId, queueId, assign: true }, 'admin')
    const result = await getAssignments({ reportIds: [reportId] })
    expect(result.assignments.length).toBe(1)
    expect(result.assignments[0].queueView).toBeDefined()
    expect(result.assignments[0].queueView!.id).toBe(queueId)
    expect(result.assignments[0].queueView!.name).toBe('Report Queue')
  })

  it('cannot double assign', async () => {
    const reportId = 3004
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
