import AtpAgent from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons.js'
import { REASONSPAM } from '../src/lexicon/types/com/atproto/moderation/defs.js'

const DEFS = 'tools.ozone.report.defs'

describe('report-activity', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const modHeaders = async (nsid: string) =>
    network.ozone.modHeaders(nsid, 'admin')

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
      { status: 'open', subject: subjectDid },
      { headers: await modHeaders(ids.ToolsOzoneReportQueryReports) },
    )
    const report = data.reports[0]
    if (!report) throw new Error(`No report found for subject ${subjectDid}`)
    return report
  }

  const createActivity = async (
    input: {
      reportId: number
      activity: { $type: string; [k: string]: unknown }
      internalNote?: string
      publicNote?: string
      isAutomated?: boolean
    },
    role: 'admin' | 'triage' = 'admin',
  ) => {
    return agent.tools.ozone.report.createActivity(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportCreateActivity,
        role,
      ),
    })
  }

  const listActivities = async (
    params: { reportId: number; limit?: number; cursor?: string },
    role: 'admin' | 'triage' = 'admin',
  ) => {
    return agent.tools.ozone.report.listActivities(params, {
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportListActivities,
        role,
      ),
    })
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_activity',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  describe('createActivity — noteActivity', () => {
    it('creates an internal note', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#noteActivity` },
        internalNote: 'Looks like this may be a bot account.',
      })

      expect(data.activity.reportId).toBe(report.id)
      expect(data.activity.activity.$type).toBe(`${DEFS}#noteActivity`)
      expect(data.activity.internalNote).toBe(
        'Looks like this may be a bot account.',
      )
      expect(data.activity.publicNote).toBeUndefined()
      expect(data.activity.isAutomated).toBe(false)
      expect(data.activity.createdBy).toBeDefined()
      expect(data.activity.createdAt).toBeDefined()
      expect(data.activity.id).toBeDefined()
    })

    it('creates a public note', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#noteActivity` },
        publicNote: 'We have reviewed your report.',
      })

      expect(data.activity.activity.$type).toBe(`${DEFS}#noteActivity`)
      expect(data.activity.publicNote).toBe('We have reviewed your report.')
      expect(data.activity.internalNote).toBeUndefined()
    })

    it('creates a note without text', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#noteActivity` },
      })

      expect(data.activity.activity.$type).toBe(`${DEFS}#noteActivity`)
      expect(data.activity.internalNote).toBeUndefined()
      expect(data.activity.publicNote).toBeUndefined()
    })

    it('does not change report status', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#noteActivity` },
        internalNote: 'Just noting this.',
      })

      const { data: updated } = await agent.tools.ozone.report.getReport(
        { id: report.id },
        { headers: await modHeaders(ids.ToolsOzoneReportGetReport) },
      )
      expect(updated.status).toBe('open')
    })
  })

  describe('createActivity — state-change activities (valid transitions)', () => {
    it('open → closed (closeActivity)', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#closeActivity` },
      })

      expect(data.activity.activity.$type).toBe(`${DEFS}#closeActivity`)
      if ('previousStatus' in data.activity.activity) {
        expect(data.activity.activity.previousStatus).toBe('open')
      }

      const { data: updated } = await agent.tools.ozone.report.getReport(
        { id: report.id },
        { headers: await modHeaders(ids.ToolsOzoneReportGetReport) },
      )
      expect(updated.status).toBe('closed')
    })

    it('open → escalated (escalationActivity)', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#escalationActivity` },
      })

      expect(data.activity.activity.$type).toBe(`${DEFS}#escalationActivity`)
      if ('previousStatus' in data.activity.activity) {
        expect(data.activity.activity.previousStatus).toBe('open')
      }
    })

    it('open → queued (queueActivity)', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#queueActivity` },
      })

      expect(data.activity.activity.$type).toBe(`${DEFS}#queueActivity`)
      if ('previousStatus' in data.activity.activity) {
        expect(data.activity.activity.previousStatus).toBe('open')
      }
    })

    it('open → assigned (assignmentActivity)', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#assignmentActivity` },
      })

      expect(data.activity.activity.$type).toBe(`${DEFS}#assignmentActivity`)
      if ('previousStatus' in data.activity.activity) {
        expect(data.activity.activity.previousStatus).toBe('open')
      }
    })

    it('queued → assigned (assignmentActivity)', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#queueActivity` },
      })
      const { data } = await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#assignmentActivity` },
      })

      if ('previousStatus' in data.activity.activity) {
        expect(data.activity.activity.previousStatus).toBe('queued')
      }
    })

    it('escalated → closed (closeActivity)', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#escalationActivity` },
      })
      const { data } = await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#closeActivity` },
      })

      if ('previousStatus' in data.activity.activity) {
        expect(data.activity.activity.previousStatus).toBe('escalated')
      }
    })

    it('assigned → closed (closeActivity)', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#assignmentActivity` },
      })
      const { data } = await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#closeActivity` },
      })

      if ('previousStatus' in data.activity.activity) {
        expect(data.activity.activity.previousStatus).toBe('assigned')
      }
    })

    it('assigned → escalated (escalationActivity)', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#assignmentActivity` },
      })
      const { data } = await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#escalationActivity` },
      })

      if ('previousStatus' in data.activity.activity) {
        expect(data.activity.activity.previousStatus).toBe('assigned')
      }
    })

    it('closed → open (reopenActivity)', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#closeActivity` },
      })
      const { data } = await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#reopenActivity` },
      })

      expect(data.activity.activity.$type).toBe(`${DEFS}#reopenActivity`)
      if ('previousStatus' in data.activity.activity) {
        expect(data.activity.activity.previousStatus).toBe('closed')
      }

      const { data: updated } = await agent.tools.ozone.report.getReport(
        { id: report.id },
        { headers: await modHeaders(ids.ToolsOzoneReportGetReport) },
      )
      expect(updated.status).toBe('open')
    })

    it('attaches internalNote and publicNote alongside a state-change', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#closeActivity` },
        internalNote: 'Confirmed spam internally.',
        publicNote: 'We have closed your report.',
      })

      expect(data.activity.activity.$type).toBe(`${DEFS}#closeActivity`)
      expect(data.activity.internalNote).toBe('Confirmed spam internally.')
      expect(data.activity.publicNote).toBe('We have closed your report.')
    })
  })

  describe('createActivity — AlreadyInTargetState', () => {
    it('rejects when report is already in the target status', async () => {
      const report = await createReport(sc.dids.alice)
      // Report starts as 'open', closeActivity targets 'closed'
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#closeActivity` },
      })
      await expect(
        createActivity({
          reportId: report.id,
          activity: { $type: `${DEFS}#closeActivity` },
        }),
      ).rejects.toMatchObject({ error: 'AlreadyInTargetState' })
    })

    it('does not record an activity when AlreadyInTargetState is thrown', async () => {
      const report = await createReport(sc.dids.alice)
      // queueActivity targets 'queued' — report already starts 'open' so first one works
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#queueActivity` },
      })
      await expect(
        createActivity({
          reportId: report.id,
          activity: { $type: `${DEFS}#queueActivity` },
        }),
      ).rejects.toMatchObject({ error: 'AlreadyInTargetState' })

      const { data } = await listActivities({ reportId: report.id })
      expect(data.activities).toHaveLength(1)
    })
  })

  describe('createActivity — InvalidStateTransition', () => {
    it('rejects closed → escalated', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#closeActivity` },
      })
      await expect(
        createActivity({
          reportId: report.id,
          activity: { $type: `${DEFS}#escalationActivity` },
        }),
      ).rejects.toMatchObject({ error: 'InvalidStateTransition' })
    })

    it('rejects closed → queued', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#closeActivity` },
      })
      await expect(
        createActivity({
          reportId: report.id,
          activity: { $type: `${DEFS}#queueActivity` },
        }),
      ).rejects.toMatchObject({ error: 'InvalidStateTransition' })
    })

    it('rejects escalated → queued', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#escalationActivity` },
      })
      await expect(
        createActivity({
          reportId: report.id,
          activity: { $type: `${DEFS}#queueActivity` },
        }),
      ).rejects.toMatchObject({ error: 'InvalidStateTransition' })
    })

    it('rejects queued → closed', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#queueActivity` },
      })
      await expect(
        createActivity({
          reportId: report.id,
          activity: { $type: `${DEFS}#closeActivity` },
        }),
      ).rejects.toMatchObject({ error: 'InvalidStateTransition' })
    })

    it('rejects reopenActivity on open report', async () => {
      const report = await createReport(sc.dids.alice)
      // report starts as 'open', reopenActivity only valid from 'closed'
      await expect(
        createActivity({
          reportId: report.id,
          activity: { $type: `${DEFS}#reopenActivity` },
        }),
      ).rejects.toMatchObject({ error: 'InvalidStateTransition' })
    })

    it('rejects reopenActivity on escalated report', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#escalationActivity` },
      })
      await expect(
        createActivity({
          reportId: report.id,
          activity: { $type: `${DEFS}#reopenActivity` },
        }),
      ).rejects.toMatchObject({ error: 'InvalidStateTransition' })
    })
  })

  describe('createActivity — input validation errors', () => {
    it('rejects unknown activity type', async () => {
      const report = await createReport(sc.dids.alice)
      await expect(
        createActivity({
          reportId: report.id,
          activity: { $type: `${DEFS}#unknownActivity` },
        }),
      ).rejects.toMatchObject({ error: 'InvalidActivityType' })
    })

    it('rejects unknown reportId', async () => {
      await expect(
        createActivity({
          reportId: 999999,
          activity: { $type: `${DEFS}#noteActivity` },
          internalNote: 'Ghost report',
        }),
      ).rejects.toMatchObject({ error: 'ReportNotFound' })
    })
  })

  describe('listActivities', () => {
    it('returns empty list for report with no activities', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await listActivities({ reportId: report.id })

      expect(data.activities).toEqual([])
      expect(data.cursor).toBeUndefined()
    })

    it('returns activities sorted most-recent-first', async () => {
      const report = await createReport(sc.dids.alice)

      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#noteActivity` },
        internalNote: 'First note',
      })
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#escalationActivity` },
      })
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#noteActivity` },
        internalNote: 'Third note',
      })

      const { data } = await listActivities({ reportId: report.id })

      expect(data.activities).toHaveLength(3)
      expect(data.activities[0].id).toBeGreaterThan(data.activities[1].id)
      expect(data.activities[1].id).toBeGreaterThan(data.activities[2].id)
      expect(data.activities[0].internalNote).toBe('Third note')
      expect(data.activities[2].internalNote).toBe('First note')
    })

    it('returns correct shape for each activity type', async () => {
      const report = await createReport(sc.dids.alice)

      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#noteActivity` },
        internalNote: 'n',
      })
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#closeActivity` },
      })

      const { data } = await listActivities({ reportId: report.id })
      const [closeAct, noteAct] = data.activities // most-recent first

      expect(closeAct.activity.$type).toBe(`${DEFS}#closeActivity`)
      if ('previousStatus' in closeAct.activity) {
        expect(closeAct.activity.previousStatus).toBe('open')
      }
      expect(closeAct.internalNote).toBeUndefined()
      expect(closeAct.isAutomated).toBe(false)

      expect(noteAct.activity.$type).toBe(`${DEFS}#noteActivity`)
      expect('previousStatus' in noteAct.activity).toBe(false)
      expect(noteAct.internalNote).toBe('n')
    })

    it('paginates correctly', async () => {
      const report = await createReport(sc.dids.alice)

      for (let i = 0; i < 5; i++) {
        await createActivity({
          reportId: report.id,
          activity: { $type: `${DEFS}#noteActivity` },
          internalNote: `Note ${i}`,
        })
      }

      const firstPage = await listActivities({ reportId: report.id, limit: 2 })
      expect(firstPage.data.activities).toHaveLength(2)
      expect(firstPage.data.cursor).toBeDefined()

      const secondPage = await listActivities({
        reportId: report.id,
        limit: 2,
        cursor: firstPage.data.cursor,
      })
      expect(secondPage.data.activities).toHaveLength(2)
      expect(secondPage.data.cursor).toBeDefined()

      const thirdPage = await listActivities({
        reportId: report.id,
        limit: 2,
        cursor: secondPage.data.cursor,
      })
      expect(thirdPage.data.activities).toHaveLength(1)
      expect(thirdPage.data.cursor).toBeUndefined()

      const allIds = [
        ...firstPage.data.activities,
        ...secondPage.data.activities,
        ...thirdPage.data.activities,
      ].map((a) => a.id)
      expect(new Set(allIds).size).toBe(5)
    })

    it('only returns activities for the requested report', async () => {
      const reportA = await createReport(sc.dids.alice)
      const reportB = await createReport(sc.dids.bob)

      await createActivity({
        reportId: reportA.id,
        activity: { $type: `${DEFS}#noteActivity` },
        internalNote: 'Note on A',
      })
      await createActivity({
        reportId: reportB.id,
        activity: { $type: `${DEFS}#noteActivity` },
        internalNote: 'Note on B',
      })

      const { data } = await listActivities({ reportId: reportA.id })
      expect(data.activities.every((a) => a.reportId === reportA.id)).toBe(true)
      expect(data.activities.some((a) => a.reportId === reportB.id)).toBe(false)
    })
  })

  describe('queryActivities', () => {
    const queryActivities = async (
      params: {
        activityTypes?: string[]
        createdAfter?: string
        createdBefore?: string
        sortDirection?: 'asc' | 'desc'
        limit?: number
        cursor?: string
      },
      role: 'admin' | 'triage' = 'admin',
    ) => {
      return agent.tools.ozone.report.queryActivities(params, {
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneReportQueryActivities,
          role,
        ),
      })
    }

    it('hydrates the report on each activity', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#closeActivity` },
      })

      const { data } = await queryActivities({
        activityTypes: ['closeActivity'],
        sortDirection: 'desc',
        limit: 100,
      })
      const hit = data.activities.find((a) => a.reportId === report.id)
      expect(hit).toBeDefined()
      expect(hit!.report).toBeDefined()
      expect(hit!.report!.id).toBe(report.id)
      expect(hit!.report!.subject).toBeDefined()
    })

    it('filters by activity types across reports', async () => {
      const reportA = await createReport(sc.dids.alice)
      const reportB = await createReport(sc.dids.bob)
      await createActivity({
        reportId: reportA.id,
        activity: { $type: `${DEFS}#noteActivity` },
        internalNote: 'note',
      })
      await createActivity({
        reportId: reportA.id,
        activity: { $type: `${DEFS}#closeActivity` },
      })
      await createActivity({
        reportId: reportB.id,
        activity: { $type: `${DEFS}#escalationActivity` },
      })

      const { data } = await queryActivities({
        activityTypes: ['closeActivity', 'escalationActivity'],
        sortDirection: 'asc',
      })

      const types = new Set(data.activities.map((a) => a.activity.$type))
      expect(types.has(`${DEFS}#noteActivity`)).toBe(false)
      expect(types.has(`${DEFS}#closeActivity`)).toBe(true)
      expect(types.has(`${DEFS}#escalationActivity`)).toBe(true)
      const reportIds = new Set(data.activities.map((a) => a.reportId))
      expect(reportIds.has(reportA.id)).toBe(true)
      expect(reportIds.has(reportB.id)).toBe(true)
    })

    it('paginates ascending across multiple reports with stable cursor', async () => {
      const reportA = await createReport(sc.dids.alice)
      const reportB = await createReport(sc.dids.bob)
      const created: number[] = []
      for (let i = 0; i < 3; i++) {
        const r = await createActivity({
          reportId: i % 2 === 0 ? reportA.id : reportB.id,
          activity: { $type: `${DEFS}#noteActivity` },
          internalNote: `n-${i}`,
        })
        created.push(r.data.activity.id)
      }
      const minId = Math.min(...created)

      const seen: number[] = []
      let cursor: string | undefined
      let pages = 0
      do {
        const { data } = await queryActivities({
          sortDirection: 'asc',
          limit: 2,
          cursor,
        })
        for (const a of data.activities) {
          if (a.id >= minId) seen.push(a.id)
        }
        cursor = data.cursor
        pages++
        if (pages > 50) break // safety net for runaway loops
      } while (cursor)

      // The created activities should appear in ascending ID order, no dupes.
      const sortedCreated = [...created].sort((a, b) => a - b)
      const seenForCreated = seen.filter((id) => created.includes(id))
      expect(seenForCreated).toEqual(sortedCreated)
    })

    it('respects createdBefore and createdAfter bounds', async () => {
      const report = await createReport(sc.dids.alice)
      const before = await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#noteActivity` },
        internalNote: 'before',
      })
      // Small wait so the next activity's createdAt is strictly later.
      await new Promise((r) => setTimeout(r, 50))
      const cutoff = new Date().toISOString()
      await new Promise((r) => setTimeout(r, 50))
      const after = await createActivity({
        reportId: report.id,
        activity: { $type: `${DEFS}#noteActivity` },
        internalNote: 'after',
      })

      const beforeRes = await queryActivities({
        createdBefore: cutoff,
        sortDirection: 'asc',
        limit: 100,
      })
      const beforeIds = new Set(beforeRes.data.activities.map((a) => a.id))
      expect(beforeIds.has(before.data.activity.id)).toBe(true)
      expect(beforeIds.has(after.data.activity.id)).toBe(false)

      const afterRes = await queryActivities({
        createdAfter: cutoff,
        sortDirection: 'asc',
        limit: 100,
      })
      const afterIds = new Set(afterRes.data.activities.map((a) => a.id))
      expect(afterIds.has(before.data.activity.id)).toBe(false)
      expect(afterIds.has(after.data.activity.id)).toBe(true)
    })
  })
})
