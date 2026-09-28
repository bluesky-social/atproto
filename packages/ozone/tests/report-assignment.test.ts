import { sql } from 'kysely'
import { ComAtprotoModerationDefs, ids } from '@atproto/api'
import type {
  ToolsOzoneReportAssignModerator,
  ToolsOzoneReportGetAssignments,
  ToolsOzoneReportListActivities,
  ToolsOzoneReportUnassignModerator,
} from '@atproto/api'
import type AtpAgent from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { tools } from '../src/lexicons/index.js'

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

  const listActivities = async (
    params: ToolsOzoneReportListActivities.QueryParams,
    callerRole: 'admin' | 'moderator' | 'triage' = 'admin',
  ) => {
    const { data } = await agent.tools.ozone.report.listActivities(params, {
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportListActivities,
        callerRole,
      ),
    })
    return data
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
    // Report rows are inserted asynchronously by the queue-router daemon —
    // drain it before looking up the row.
    await network.processAll()
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
    agent = network.ozone.getAgent()
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
    await network?.close()
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

    it('records assignedTo in activity meta when admin assigns to another mod', async () => {
      const reportId = await createReport()
      const assignment = await assignReport(
        { reportId, isPermanent: true, did: network.ozone.moderatorAccnt.did },
        'admin',
      )
      expect(assignment.reportId).toBe(reportId)
      expect(assignment.moderator?.did).toBe(network.ozone.moderatorAccnt.did)

      const { activities } = await listActivities({ reportId })
      const assignmentActivity = activities.find(
        (a) =>
          a.activity.$type === 'tools.ozone.report.defs#assignmentActivity',
      )
      expect(assignmentActivity).toBeDefined()
      expect(assignmentActivity!.meta?.assignedTo).toBe(
        network.ozone.moderatorAccnt.did,
      )
      expect(assignmentActivity!.createdBy).toBe(network.ozone.adminAccnt.did)
    })

    it('non-admin cannot assign to a different user', async () => {
      const reportId = await createReport()
      await expect(
        assignReport(
          { reportId, isPermanent: true, did: network.ozone.adminAccnt.did },
          'moderator',
        ),
      ).rejects.toThrow('Unauthorized')
    })

    it('assignedTo equals createdBy when mod assigns to self', async () => {
      const reportId = await createReport()
      await assignReport(
        { reportId, isPermanent: true, did: network.ozone.moderatorAccnt.did },
        'moderator',
      )

      const { activities } = await listActivities({ reportId })
      const assignmentActivity = activities.find(
        (a) =>
          a.activity.$type === 'tools.ozone.report.defs#assignmentActivity',
      )
      expect(assignmentActivity).toBeDefined()
      expect(assignmentActivity!.meta?.assignedTo).toBe(
        network.ozone.moderatorAccnt.did,
      )
      expect(assignmentActivity!.createdBy).toBe(
        network.ozone.moderatorAccnt.did,
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

  describe('unassignment activity', () => {
    it.each([
      { status: 'assigned', withQueue: false, expectedStatus: 'open' },
      { status: 'assigned', withQueue: true, expectedStatus: 'queued' },
      { status: 'closed', withQueue: false, expectedStatus: 'closed' },
      { status: 'closed', withQueue: true, expectedStatus: 'closed' },
      { status: 'escalated', withQueue: false, expectedStatus: 'escalated' },
      { status: 'escalated', withQueue: true, expectedStatus: 'escalated' },
    ])(
      'records who unassigned a $status report (withQueue=$withQueue)',
      async ({ status, withQueue, expectedStatus }) => {
        const reportId = await createReport()
        await assignReport({
          reportId,
          queueId: withQueue ? queueId : undefined,
          isPermanent: true,
        })
        await network.ozone.ctx.db.db
          .updateTable('report')
          .set({ status })
          .where('id', '=', reportId)
          .execute()

        const before = Date.now()
        const assignment = await unassignReport({ reportId }, 'admin')
        const { activities } = await listActivities({ reportId })
        const notes = activities.filter(
          (a) =>
            a.activity.$type === tools.ozone.report.defs.noteActivity.$type,
        )
        expect(notes).toHaveLength(1)
        expect(notes[0]).toMatchObject({
          createdBy: network.ozone.adminAccnt.did,
          isAutomated: false,
          internalNote: `Report unassigned from ${network.ozone.moderatorAccnt.did}.`,
          meta: { unassignedFrom: network.ozone.moderatorAccnt.did },
          createdAt: assignment.endAt,
        })
        expect(new Date(notes[0].createdAt).getTime()).toBeGreaterThanOrEqual(
          before,
        )
        expect(new Date(notes[0].createdAt).getTime()).toBeLessThanOrEqual(
          Date.now(),
        )
        const report = await network.ozone.ctx.db.db
          .selectFrom('report')
          .select(['status', 'assignedTo', 'assignedAt'])
          .where('id', '=', reportId)
          .executeTakeFirstOrThrow()
        expect(report).toEqual({
          status: expectedStatus,
          assignedTo: null,
          assignedAt: null,
        })
        expect(
          (await getAssignments({ reportIds: [reportId] })).assignments,
        ).toHaveLength(0)
      },
    )

    it('records explicit unassignment of a temporary assignment', async () => {
      const reportId = await createReport()
      await assignReport({ reportId })
      await unassignReport({ reportId })
      const { activities } = await listActivities({ reportId })
      expect(activities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            activity: { $type: tools.ozone.report.defs.noteActivity.$type },
            createdBy: network.ozone.moderatorAccnt.did,
            meta: { unassignedFrom: network.ozone.moderatorAccnt.did },
          }),
        ]),
      )
    })

    it('does not record another activity when unassignment is retried', async () => {
      const reportId = await createReport()
      await assignReport({ reportId, isPermanent: true })
      await unassignReport({ reportId })
      const before = await listActivities({ reportId })
      await expect(unassignReport({ reportId })).rejects.toThrow(
        'Report is not assigned',
      )
      expect(await listActivities({ reportId })).toEqual(before)
    })

    it('records a single activity for concurrent unassignment requests', async () => {
      const reportId = await createReport()
      await assignReport({ reportId, isPermanent: true })
      const results = await Promise.allSettled([
        unassignReport({ reportId }),
        unassignReport({ reportId }),
      ])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
      const { activities } = await listActivities({ reportId })
      expect(
        activities.filter(
          (a) =>
            a.activity.$type === tools.ozone.report.defs.noteActivity.$type,
        ),
      ).toHaveLength(1)
    })

    it.each([false, true])(
      'rolls back unassignment if its activity cannot be stored (withQueue=%s)',
      async (withQueue) => {
        const reportId = await createReport()
        await assignReport({
          reportId,
          queueId: withQueue ? queueId : undefined,
          isPermanent: true,
        })
        const db = network.ozone.ctx.db.db
        const before = await listActivities({ reportId })
        await db.schema
          .alterTable('report_activity')
          .addCheckConstraint(
            'reject_unassignment_note',
            sql`"reportId" <> ${sql.lit(reportId)} or "activityType" <> 'noteActivity'`,
          )
          .execute()
        try {
          await expect(unassignReport({ reportId })).rejects.toThrow()
          const report = await db
            .selectFrom('report')
            .select(['status', 'assignedTo', 'assignedAt'])
            .where('id', '=', reportId)
            .executeTakeFirstOrThrow()
          expect(report.status).toBe('assigned')
          expect(report.assignedTo).toBe(network.ozone.moderatorAccnt.did)
          expect(report.assignedAt).not.toBeNull()
          const { assignments } = await getAssignments({
            reportIds: [reportId],
          })
          expect(assignments).toHaveLength(1)
          expect(assignments[0].endAt).toBeUndefined()
          expect(await listActivities({ reportId })).toEqual(before)
        } finally {
          await db.schema
            .alterTable('report_activity')
            .dropConstraint('reject_unassignment_note')
            .execute()
        }
      },
    )
  })

  describe('unassign returns report to queue', () => {
    const getReportStatus = async (reportId: number) => {
      const row = await network.ozone.ctx.db.db
        .selectFrom('report')
        .select('status')
        .where('id', '=', reportId)
        .executeTakeFirstOrThrow()
      return row.status
    }

    it('flips status from assigned back to queued and logs queueActivity', async () => {
      const reportId = await createReport()
      await assignReport({ reportId, queueId, isPermanent: true }, 'moderator')
      expect(await getReportStatus(reportId)).toBe('assigned')

      await unassignReport({ reportId }, 'moderator')
      expect(await getReportStatus(reportId)).toBe('queued')

      const { activities } = await listActivities({ reportId })
      const queueActivity = activities.find(
        (a) => a.activity.$type === 'tools.ozone.report.defs#queueActivity',
      )
      expect(queueActivity).toBeDefined()
      if ('previousStatus' in queueActivity!.activity) {
        expect(queueActivity!.activity.previousStatus).toBe('assigned')
      }
      expect(queueActivity!.createdBy).toBe(network.ozone.moderatorAccnt.did)
      expect(queueActivity!.isAutomated).toBe(false)
    })

    it('flips status from assigned back to open when assignment had no queueId', async () => {
      const reportId = await createReport()
      await assignReport({ reportId, isPermanent: true }, 'moderator')
      expect(await getReportStatus(reportId)).toBe('assigned')

      await unassignReport({ reportId }, 'moderator')
      // No queueId on the assignment, so the report goes back to 'open'.
      expect(await getReportStatus(reportId)).toBe('open')

      const { activities } = await listActivities({ reportId })
      const queueActivity = activities.find(
        (a) => a.activity.$type === 'tools.ozone.report.defs#queueActivity',
      )
      expect(queueActivity).toBeUndefined()
    })
  })
})
