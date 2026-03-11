import AtpAgent, {
  ComAtprotoModerationDefs,
  ToolsOzoneReportAssignModerator,
  ToolsOzoneReportGetAssignments,
  ToolsOzoneReportUnassignModerator,
} from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'

describe('report-assignment', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const assignReport = async (
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

  const unassignReport = async (
    input: ToolsOzoneReportUnassignModerator.InputSchema,
    callerRole: 'admin' | 'moderator' | 'triage' = 'moderator',
  ) => {
    const { data } = await agent.tools.ozone.report.unassignModerator(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportUnassignModerator,
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

  const createReport = async (): Promise<number> => {
    const event = await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.bob,
      },
      reportedBy: sc.dids.alice,
    })
    const report = await network.ozone.ctx.db.db
      .selectFrom('report')
      .select('id')
      .where('eventId', '=', event.id)
      .executeTakeFirstOrThrow()
    return report.id
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
    const reportId = await createReport()
    await assignReport({ reportId }, 'moderator')
    const result = await getAssignments({ reportIds: [reportId] })
    expect(result.assignments.length).toBe(1)
  })

  it('moderator can assign', async () => {
    const reportId = await createReport()
    const assignment = await assignReport({ reportId }, 'moderator')
    expect(assignment.reportId).toBe(reportId)
    expect(assignment.moderator?.did).toBe(network.ozone.moderatorAccnt.did)
    expect(new Date(assignment.endAt!).getTime()).toBeGreaterThanOrEqual(
      new Date().getTime(),
    )
  })

  it('moderator can refresh assignment', async () => {
    const reportId = await createReport()
    const assignment1 = await assignReport({ reportId }, 'moderator')
    const assignment2 = await assignReport({ reportId }, 'moderator')
    expect(assignment2.moderator?.did).toBe(network.ozone.moderatorAccnt.did)
    expect(new Date(assignment2.endAt!).getTime()).toBeGreaterThan(
      new Date(assignment1.endAt!).getTime(),
    )
  })

  it('moderator can assign then un-assign a report', async () => {
    const reportId = await createReport()
    await assignReport({ reportId }, 'moderator')
    const assignment = await unassignReport({ reportId }, 'moderator')
    expect(new Date(assignment.endAt!).getTime()).toBeLessThanOrEqual(
      new Date().getTime(),
    )
  })

  it('assignment can be exchanged', async () => {
    const reportId = await createReport()
    await assignReport({ reportId }, 'admin')
    await unassignReport({ reportId }, 'moderator')
    const assignment = await assignReport({ reportId }, 'moderator')
    expect(assignment.reportId).toBe(reportId)
    expect(assignment.moderator?.did).toBe(network.ozone.moderatorAccnt.did)
    expect(new Date(assignment.endAt!).getTime()).toBeGreaterThanOrEqual(
      new Date().getTime(),
    )
  })

  it('invalid assignment throws error', async () => {
    const reportId = 999999
    await expect(assignReport({ reportId }, 'moderator')).rejects.toThrow(
      'Invalid report',
    )
  })

  it('invalid unassignment throws error', async () => {
    const reportId = await createReport()
    await expect(unassignReport({ reportId }, 'moderator')).rejects.toThrow(
      'Report is not assigned',
    )
  })

  describe('pagination', () => {
    it('paginates assignments with limit', async () => {
      await clearAssignments()
      const r1 = await createReport()
      const r2 = await createReport()
      const r3 = await createReport()
      await assignReport({ reportId: r1 }, 'admin')
      await assignReport({ reportId: r2 }, 'admin')
      await assignReport({ reportId: r3 }, 'admin')

      const firstPage = await getAssignments({ limit: 2 })
      expect(firstPage.assignments.length).toBe(2)
      expect(firstPage.cursor).toBeDefined()
    })

    it('returns all results when limit exceeds total', async () => {
      await clearAssignments()
      const r1 = await createReport()
      const r2 = await createReport()
      await assignReport({ reportId: r1 }, 'admin')
      await assignReport({ reportId: r2 }, 'admin')

      const result = await getAssignments({ limit: 50 })
      expect(result.assignments.length).toBe(2)
      expect(result.cursor).toBeDefined()
    })

    it('fetches next page using cursor', async () => {
      await clearAssignments()
      const r1 = await createReport()
      const r2 = await createReport()
      const r3 = await createReport()
      await assignReport({ reportId: r1 }, 'admin')
      await assignReport({ reportId: r2 }, 'admin')
      await assignReport({ reportId: r3 }, 'admin')

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
      const r1 = await createReport()
      const r2 = await createReport()
      const r3 = await createReport()
      await assignReport({ reportId: r1 }, 'admin')
      await assignReport({ reportId: r2 }, 'admin')
      await assignReport({ reportId: r3 }, 'admin')

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
      const r1 = await createReport()
      const r2 = await createReport()
      const r3 = await createReport()
      await assignReport({ reportId: r1 }, 'admin')
      await assignReport({ reportId: r2 }, 'admin')
      await assignReport({ reportId: r3 }, 'moderator')

      const result = await getAssignments({
        dids: [network.ozone.adminAccnt.did],
        limit: 1,
      })
      expect(result.assignments.length).toBe(1)
      expect(result.assignments[0].moderator?.did).toBe(
        network.ozone.adminAccnt.did,
      )
      expect(result.cursor).toBeDefined()

      const nextPage = await getAssignments({
        dids: [network.ozone.adminAccnt.did],
        limit: 1,
        cursor: result.cursor,
      })
      expect(nextPage.assignments.length).toBe(1)
      expect(nextPage.assignments[0].moderator?.did).toBe(
        network.ozone.adminAccnt.did,
      )
    })
  })

  it('hydrates queue when queueId is provided', async () => {
    const reportId = await createReport()
    const assignment = await assignReport({ reportId, queueId }, 'admin')
    expect(assignment.reportId).toBe(reportId)
    expect(assignment.queue).toBeDefined()
    expect(assignment.queue!.id).toBe(queueId)
    expect(assignment.queue!.name).toBe('Report Queue')
    expect(assignment.queue!.subjectTypes).toEqual(['account'])
  })

  it('omits queue when no queueId is provided', async () => {
    const reportId = await createReport()
    const assignment = await assignReport({ reportId }, 'admin')
    expect(assignment.reportId).toBe(reportId)
    expect(assignment.queue).toBeUndefined()
  })

  it('hydrates queue in getAssignments', async () => {
    await clearAssignments()
    const reportId = await createReport()
    await assignReport({ reportId, queueId }, 'admin')
    const result = await getAssignments({ reportIds: [reportId] })
    expect(result.assignments.length).toBe(1)
    expect(result.assignments[0].queue).toBeDefined()
    expect(result.assignments[0].queue!.id).toBe(queueId)
    expect(result.assignments[0].queue!.name).toBe('Report Queue')
  })

  it('cannot double assign', async () => {
    const reportId = await createReport()
    await assignReport({ reportId }, 'moderator')
    await expect(assignReport({ reportId }, 'admin')).rejects.toThrow(
      'Report already assigned',
    )
  })

  describe('isPermanent', () => {
    it('creates a permanent assignment with no endAt', async () => {
      const reportId = await createReport()
      const assignment = await assignReport(
        { reportId, isPermanent: true },
        'moderator',
      )
      expect(assignment.reportId).toBe(reportId)
      expect(assignment.endAt).toBeUndefined()
    })

    it('upgrades an active assignment to permanent', async () => {
      const reportId = await createReport()
      const temp = await assignReport({ reportId }, 'moderator')
      expect(temp.endAt).toBeDefined()

      const permanent = await assignReport(
        { reportId, isPermanent: true },
        'moderator',
      )
      expect(permanent.id).toBe(temp.id)
      expect(permanent.endAt).toBeUndefined()
    })

    it('permanent assignment is unassignable', async () => {
      const reportId = await createReport()
      await assignReport({ reportId, isPermanent: true }, 'moderator')
      const unassigned = await unassignReport({ reportId }, 'moderator')
      expect(new Date(unassigned.endAt!).getTime()).toBeLessThanOrEqual(
        new Date().getTime(),
      )
    })

    it('throws AlreadyAssigned when another user has a permanent assignment', async () => {
      const reportId = await createReport()
      await assignReport({ reportId, isPermanent: true }, 'moderator')
      await expect(
        assignReport({ reportId, isPermanent: true }, 'admin'),
      ).rejects.toThrow('Report already assigned')
    })

    it('throws AlreadyAssigned for non-permanent assignment when another user holds permanent', async () => {
      const reportId = await createReport()
      await assignReport({ reportId, isPermanent: true }, 'moderator')
      await expect(assignReport({ reportId }, 'admin')).rejects.toThrow(
        'Report already assigned',
      )
    })

    it('same user can call isPermanent again idempotently', async () => {
      const reportId = await createReport()
      await assignReport({ reportId, isPermanent: true }, 'moderator')
      const again = await assignReport(
        { reportId, isPermanent: true },
        'moderator',
      )
      expect(again.endAt).toBeUndefined()
    })

    it('permanent assignment appears in onlyActive filter', async () => {
      await clearAssignments()
      const reportId = await createReport()
      await assignReport({ reportId, isPermanent: true }, 'moderator')
      const result = await getAssignments({ reportIds: [reportId] })
      expect(result.assignments.length).toBe(1)
      expect(result.assignments[0].endAt).toBeUndefined()
    })
  })
})
