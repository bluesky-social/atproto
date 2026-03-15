import AtpAgent from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import { REASONSPAM } from '../src/lexicon/types/com/atproto/moderation/defs'

describe('report-activity', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const modHeaders = async (nsid: string) =>
    network.ozone.modHeaders(nsid, 'admin')

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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

  const createActivity = async (
    input: {
      reportId: number
      action: string
      toState?: string
      note?: string
      updateStatus?: boolean
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

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_activity',
    })
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  // ---------------------------------------------------------------------------
  // createActivity — notes
  // ---------------------------------------------------------------------------

  describe('createActivity — note', () => {
    it('creates a standalone note', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await createActivity({
        reportId: report.id,
        action: 'note',
        note: 'Looks like this may be a bot account.',
      })

      expect(data.activity.reportId).toBe(report.id)
      expect(data.activity.action).toBe('note')
      expect(data.activity.note).toBe('Looks like this may be a bot account.')
      expect(data.activity.fromState).toBeUndefined()
      expect(data.activity.toState).toBeUndefined()
      expect(data.activity.isAutomated).toBe(false)
      expect(data.activity.createdBy).toBeDefined()
      expect(data.activity.createdAt).toBeDefined()
      expect(data.activity.id).toBeDefined()
    })

    it('creates a note without a note text (note field is optional)', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await createActivity({
        reportId: report.id,
        action: 'note',
      })

      expect(data.activity.action).toBe('note')
      expect(data.activity.note).toBeUndefined()
    })

    it('does not change report status when action is note', async () => {
      const report = await createReport(sc.dids.alice)
      expect(report.status).toBe('open')

      await createActivity({
        reportId: report.id,
        action: 'note',
        note: 'Just noting this.',
      })

      const { data: updated } = await agent.tools.ozone.report.getReport(
        { id: report.id },
        { headers: await modHeaders(ids.ToolsOzoneReportGetReport) },
      )
      expect(updated.status).toBe('open')
    })
  })

  // ---------------------------------------------------------------------------
  // createActivity — status_change valid transitions
  // ---------------------------------------------------------------------------

  describe('createActivity — status_change valid transitions', () => {
    it('open → closed', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'closed',
      })

      expect(data.activity.action).toBe('status_change')
      expect(data.activity.fromState).toBe('open')
      expect(data.activity.toState).toBe('closed')

      const { data: updated } = await agent.tools.ozone.report.getReport(
        { id: report.id },
        { headers: await modHeaders(ids.ToolsOzoneReportGetReport) },
      )
      expect(updated.status).toBe('closed')
    })

    it('closed → open (reopen)', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'closed',
      })

      const { data } = await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'open',
      })

      expect(data.activity.fromState).toBe('closed')
      expect(data.activity.toState).toBe('open')

      const { data: updated } = await agent.tools.ozone.report.getReport(
        { id: report.id },
        { headers: await modHeaders(ids.ToolsOzoneReportGetReport) },
      )
      expect(updated.status).toBe('open')
    })

    it('open → escalated', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'escalated',
      })

      expect(data.activity.fromState).toBe('open')
      expect(data.activity.toState).toBe('escalated')
    })

    it('escalated → open', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'escalated',
      })
      const { data } = await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'open',
      })

      expect(data.activity.fromState).toBe('escalated')
      expect(data.activity.toState).toBe('open')
    })

    it('escalated → closed', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'escalated',
      })
      const { data } = await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'closed',
      })

      expect(data.activity.fromState).toBe('escalated')
      expect(data.activity.toState).toBe('closed')
    })

    it('open → queued', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'queued',
      })

      expect(data.activity.fromState).toBe('open')
      expect(data.activity.toState).toBe('queued')
    })

    it('queued → assigned', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'queued',
      })
      const { data } = await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'assigned',
      })

      expect(data.activity.fromState).toBe('queued')
      expect(data.activity.toState).toBe('assigned')
    })

    it('queued → open', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'queued',
      })
      const { data } = await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'open',
      })

      expect(data.activity.fromState).toBe('queued')
      expect(data.activity.toState).toBe('open')
    })

    it('assigned → open', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'assigned',
      })
      const { data } = await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'open',
      })

      expect(data.activity.fromState).toBe('assigned')
      expect(data.activity.toState).toBe('open')
    })

    it('assigned → closed', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'assigned',
      })
      const { data } = await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'closed',
      })

      expect(data.activity.fromState).toBe('assigned')
      expect(data.activity.toState).toBe('closed')
    })

    it('assigned → escalated', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'assigned',
      })
      const { data } = await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'escalated',
      })

      expect(data.activity.fromState).toBe('assigned')
      expect(data.activity.toState).toBe('escalated')
    })

    it('includes optional note on a status_change', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'closed',
        note: 'Resolved — confirmed spam.',
      })

      expect(data.activity.toState).toBe('closed')
      expect(data.activity.note).toBe('Resolved — confirmed spam.')
    })
  })

  // ---------------------------------------------------------------------------
  // createActivity — updateStatus flag
  // ---------------------------------------------------------------------------

  describe('createActivity — updateStatus flag', () => {
    it('does not update report.status when updateStatus is false', async () => {
      const report = await createReport(sc.dids.alice)
      const { data } = await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'closed',
        updateStatus: false,
      })

      // Activity is logged
      expect(data.activity.fromState).toBe('open')
      expect(data.activity.toState).toBe('closed')

      // Report status is unchanged
      const { data: updated } = await agent.tools.ozone.report.getReport(
        { id: report.id },
        { headers: await modHeaders(ids.ToolsOzoneReportGetReport) },
      )
      expect(updated.status).toBe('open')
    })
  })

  // ---------------------------------------------------------------------------
  // createActivity — invalid transitions
  // ---------------------------------------------------------------------------

  describe('createActivity — invalid transitions', () => {
    it('rejects open → open', async () => {
      const report = await createReport(sc.dids.alice)
      await expect(
        createActivity({
          reportId: report.id,
          action: 'status_change',
          toState: 'open',
        }),
      ).rejects.toMatchObject({ error: 'InvalidStateTransition' })
    })

    it('rejects closed → escalated', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'closed',
      })
      await expect(
        createActivity({
          reportId: report.id,
          action: 'status_change',
          toState: 'escalated',
        }),
      ).rejects.toMatchObject({ error: 'InvalidStateTransition' })
    })

    it('rejects closed → queued', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'closed',
      })
      await expect(
        createActivity({
          reportId: report.id,
          action: 'status_change',
          toState: 'queued',
        }),
      ).rejects.toMatchObject({ error: 'InvalidStateTransition' })
    })

    it('rejects escalated → queued', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'escalated',
      })
      await expect(
        createActivity({
          reportId: report.id,
          action: 'status_change',
          toState: 'queued',
        }),
      ).rejects.toMatchObject({ error: 'InvalidStateTransition' })
    })

    it('rejects queued → closed', async () => {
      const report = await createReport(sc.dids.alice)
      await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'queued',
      })
      await expect(
        createActivity({
          reportId: report.id,
          action: 'status_change',
          toState: 'closed',
        }),
      ).rejects.toMatchObject({ error: 'InvalidStateTransition' })
    })
  })

  // ---------------------------------------------------------------------------
  // createActivity — input validation errors
  // ---------------------------------------------------------------------------

  describe('createActivity — input validation errors', () => {
    it('rejects status_change without toState', async () => {
      const report = await createReport(sc.dids.alice)
      await expect(
        createActivity({
          reportId: report.id,
          action: 'status_change',
        }),
      ).rejects.toMatchObject({ error: 'MissingTargetState' })
    })

    it('rejects unknown reportId', async () => {
      await expect(
        createActivity({
          reportId: 999999,
          action: 'note',
          note: 'Ghost report',
        }),
      ).rejects.toMatchObject({ error: 'ReportNotFound' })
    })
  })

  // ---------------------------------------------------------------------------
  // listActivities
  // ---------------------------------------------------------------------------

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
        action: 'note',
        note: 'First note',
      })
      await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'escalated',
      })
      await createActivity({
        reportId: report.id,
        action: 'note',
        note: 'Third note',
      })

      const { data } = await listActivities({ reportId: report.id })

      expect(data.activities).toHaveLength(3)
      // Most recent first — IDs should be descending
      expect(data.activities[0].id).toBeGreaterThan(data.activities[1].id)
      expect(data.activities[1].id).toBeGreaterThan(data.activities[2].id)
      expect(data.activities[0].note).toBe('Third note')
      expect(data.activities[2].note).toBe('First note')
    })

    it('returns correct shape for each activity type', async () => {
      const report = await createReport(sc.dids.alice)

      await createActivity({ reportId: report.id, action: 'note', note: 'n' })
      await createActivity({
        reportId: report.id,
        action: 'status_change',
        toState: 'closed',
      })

      const { data } = await listActivities({ reportId: report.id })
      const [statusChange, note] = data.activities // most-recent first

      expect(statusChange.action).toBe('status_change')
      expect(statusChange.fromState).toBe('open')
      expect(statusChange.toState).toBe('closed')
      expect(statusChange.note).toBeUndefined()
      expect(statusChange.isAutomated).toBe(false)

      expect(note.action).toBe('note')
      expect(note.fromState).toBeUndefined()
      expect(note.toState).toBeUndefined()
      expect(note.note).toBe('n')
    })

    it('paginates correctly', async () => {
      const report = await createReport(sc.dids.alice)

      // Create 5 activities
      for (let i = 0; i < 5; i++) {
        await createActivity({
          reportId: report.id,
          action: 'note',
          note: `Note ${i}`,
        })
      }

      const firstPage = await listActivities({
        reportId: report.id,
        limit: 2,
      })
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

      // No overlap between pages
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
        action: 'note',
        note: 'Note on A',
      })
      await createActivity({
        reportId: reportB.id,
        action: 'note',
        note: 'Note on B',
      })

      const { data } = await listActivities({ reportId: reportA.id })
      expect(data.activities.every((a) => a.reportId === reportA.id)).toBe(
        true,
      )
      expect(data.activities.some((a) => a.reportId === reportB.id)).toBe(false)
    })
  })
})
