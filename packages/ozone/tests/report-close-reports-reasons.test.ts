import { ids } from '@atproto/api'
import { com, tools } from '../src/lexicons/index.js'
import {
  CHAT_CONVO_COLLECTION,
  CHAT_MESSAGE_COLLECTION,
} from '../src/mod-service/subject.js'
import { setupCloseReports } from './_close-reports.js'
import type { ReportRow } from './_inbox.js'

describe('report-close-reports reasons', () => {
  const t = setupCloseReports('ozone_report_close_reports_reasons')
  const {
    closeReports,
    listActivities,
    fixture,
    reports,
    detail,
    inbox,
    setStatus,
    snapshotReports,
    expectUnchanged,
    modHeaders,
  } = t

  it.each(['all', 'types', 'exclusions'] as const)(
    'protects active review across owned subjects with %s targeting',
    async (selector) => {
      const f = await fixture()
      const created = await reports(
        [f.account, f.record, f.message, f.conversation].flatMap((subject) => [
          subject,
          subject,
          subject,
          subject,
          subject,
          { subject, reasonType: com.atproto.moderation.defs.ReasonRude },
        ]),
      )
      const selected: ReportRow[] = []
      const protectedReports: ReportRow[] = []
      for (let i = 0; i < created.length; i += 6) {
        const [open, queued, assigned, escalated, permanent, other] =
          created.slice(i, i + 6)
        selected.push(open)
        await setStatus(queued.id, 'queued')
        selected.push(queued)
        await setStatus(assigned.id, 'assigned')
        protectedReports.push(assigned)
        await setStatus(escalated.id, 'escalated')
        protectedReports.push(escalated)
        await setStatus(permanent.id, 'assigned')
        await setStatus(permanent.id, 'queued')
        protectedReports.push(permanent)
        if (selector === 'all') {
          selected.push(other)
        } else {
          protectedReports.push(other)
        }
      }
      const before = await snapshotReports(protectedReports)
      const input = {
        subject: f.did,
        includeAllOwned: true,
        isAutomated: true,
        ...(selector === 'types' && {
          reportTypes: [com.atproto.moderation.defs.ReasonSpam],
        }),
        ...(selector === 'exclusions' && {
          excludedReportTypes: [com.atproto.moderation.defs.ReasonRude],
        }),
      }
      expect((await closeReports(input)).data).toEqual({
        closedCount: selected.length,
        reportIds: selected.map(({ id }) => id),
      })
      for (const r of selected) {
        expect((await detail(r.id)).status).toBe('closed')
      }
      expect((await closeReports(input)).data).toEqual({
        closedCount: 0,
        reportIds: [],
      })
      await expectUnchanged(before)
    },
  )

  it('retains optional reason filtering across all owned subjects', async () => {
    const f = await fixture()
    const [s1, s2, s3, s4, other] = await reports([
      f.account,
      f.record,
      f.message,
      f.conversation,
      { subject: f.record, reasonType: com.atproto.moderation.defs.ReasonRude },
    ])
    const selected = [s1, s2, s3, s4]
    const { data } = await closeReports({
      subject: f.did,
      includeAllOwned: true,
      reportTypes: [com.atproto.moderation.defs.ReasonSpam],
    })
    expect(data.closedCount).toBe(selected.length)
    expect(data.reportIds.sort()).toEqual(selected.map((r) => r.id).sort())
    expect((await detail(other.id)).status).toBe('open')
    expect(
      (
        await closeReports({
          subject: f.did,
          includeAllOwned: true,
          reportTypes: [],
        })
      ).data.reportIds,
    ).toEqual([other.id])
  })

  it.each(['account', 'record', 'message', 'conversation'] as const)(
    'excludes reasons without widening the exact %s subject scope',
    async (kind) => {
      const f = await fixture()
      const foreign = await fixture()
      const [selected, excluded, ...untouched] = await reports([
        f[kind],
        {
          subject: f[kind],
          reasonType: com.atproto.moderation.defs.ReasonRude,
        },
        ...(['account', 'record', 'message', 'conversation'] as const)
          .filter((other) => other !== kind)
          .map((other) => f[other]),
        foreign[kind],
      ])
      const subject =
        kind === 'account'
          ? f.did
          : kind === 'record'
            ? f.record.uri
            : `at://${f.did}/${kind === 'message' ? CHAT_MESSAGE_COLLECTION : CHAT_CONVO_COLLECTION}/${kind === 'message' ? f.message.messageId : f.conversation.convoId}`

      expect(
        (
          await closeReports({
            subject,
            excludedReportTypes: [com.atproto.moderation.defs.ReasonRude],
          })
        ).data,
      ).toEqual({ closedCount: 1, reportIds: [selected.id] })
      for (const r of [excluded, ...untouched]) {
        expect((await detail(r.id)).status).toBe('open')
        expect(await listActivities(r.id)).toHaveLength(0)
      }
    },
  )

  it('excludes multiple reasons across owned subjects and preserves their history', async () => {
    const f = await fixture()
    const foreign = await fixture()
    const subjects = [f.account, f.record, f.message, f.conversation]
    const created = await reports([
      ...subjects,
      ...subjects.flatMap((subject) => [
        { subject, reasonType: com.atproto.moderation.defs.ReasonRude },
        { subject, reasonType: com.atproto.moderation.defs.ReasonMisleading },
      ]),
      foreign.account,
      foreign.record,
      foreign.message,
      foreign.conversation,
    ])
    const selected = created.slice(0, 4)
    const excluded = created.slice(4, 12)
    const untouched = created.slice(12)
    await t.agent.tools.ozone.report.createActivity(
      {
        reportId: excluded[0].id,
        activity: tools.ozone.report.defs.escalationActivity.$build({}),
        internalNote: 'Needs further review',
      },
      { headers: await modHeaders(ids.ToolsOzoneReportCreateActivity) },
    )
    const snapshots = await snapshotReports([...excluded, ...untouched])
    const input = {
      subject: f.did,
      includeAllOwned: true,
      excludedReportTypes: [
        com.atproto.moderation.defs.ReasonRude,
        com.atproto.moderation.defs.ReasonMisleading,
      ],
      isAutomated: true,
      meta: { source: 'example-tool' },
    }
    const { data } = await closeReports(input)
    expect(data.closedCount).toBe(selected.length)
    expect(data.reportIds.sort()).toEqual(selected.map((r) => r.id).sort())
    for (const r of selected) {
      expect((await detail(r.id)).status).toBe('closed')
      expect((await inbox(r.id)).resolution?.outcome).toBe('noAction')
      expect(await listActivities(r.id)).toEqual([
        expect.objectContaining({ isAutomated: true }),
      ])
    }
    for (const snapshot of snapshots) {
      const current = await detail(snapshot.report.id)
      expect(current.status).toBe(snapshot.report.status)
      expect(current.updatedAt).toBe(snapshot.report.updatedAt)
      expect(current.actionEventIds).toEqual(snapshot.report.actionEventIds)
      expect(current.actionNote).toBe(snapshot.report.actionNote)
      expect(await listActivities(snapshot.report.id)).toEqual(
        snapshot.activities,
      )
    }
    expect((await closeReports(input)).data).toEqual({
      closedCount: 0,
      reportIds: [],
    })
  })

  it.each([
    { reportTypes: undefined },
    { reportTypes: [] },
    { reportTypes: [com.atproto.moderation.defs.ReasonSpam] },
  ])(
    'preserves existing selection with empty exclusions and reportTypes $reportTypes',
    async ({ reportTypes }) => {
      const f = await fixture()
      const [selected, other] = await reports([
        f.account,
        {
          subject: f.account,
          reasonType: com.atproto.moderation.defs.ReasonRude,
        },
      ])
      const expected = reportTypes?.length ? [selected] : [selected, other]
      const { data } = await closeReports({
        subject: f.did,
        reportTypes,
        excludedReportTypes: [],
      })
      expect(data.closedCount).toBe(expected.length)
      expect(data.reportIds.sort()).toEqual(expected.map((r) => r.id).sort())
      if (reportTypes?.length)
        expect((await detail(other.id)).status).toBe('open')
    },
  )

  it.each([
    { reportTypes: undefined },
    { reportTypes: [] },
    { reportTypes: [com.atproto.moderation.defs.ReasonSpam] },
  ])(
    'applies exclusions with reportTypes $reportTypes',
    async ({ reportTypes }) => {
      const f = await fixture()
      const [selected, excluded] = await reports([
        f.account,
        {
          subject: f.account,
          reasonType: com.atproto.moderation.defs.ReasonRude,
        },
      ])
      expect(
        (
          await closeReports({
            subject: f.did,
            reportTypes,
            excludedReportTypes: [com.atproto.moderation.defs.ReasonRude],
          })
        ).data,
      ).toEqual({ closedCount: 1, reportIds: [selected.id] })
      expect((await detail(excluded.id)).status).toBe('open')
      expect(await listActivities(excluded.id)).toHaveLength(0)
    },
  )

  it.each([false, true])(
    'gives exclusions precedence over inclusions with all reasons excluded: %s',
    async (excludeAll) => {
      const f = await fixture()
      const [selected, excluded, outside] = await reports([
        f.account,
        {
          subject: f.account,
          reasonType: com.atproto.moderation.defs.ReasonRude,
        },
        {
          subject: f.account,
          reasonType: com.atproto.moderation.defs.ReasonMisleading,
        },
      ])
      const reportTypes = [
        com.atproto.moderation.defs.ReasonSpam,
        com.atproto.moderation.defs.ReasonRude,
      ]
      const { data } = await closeReports({
        subject: f.did,
        reportTypes,
        excludedReportTypes: excludeAll
          ? reportTypes
          : [com.atproto.moderation.defs.ReasonRude],
      })
      expect(data).toEqual({
        closedCount: excludeAll ? 0 : 1,
        reportIds: excludeAll ? [] : [selected.id],
      })
      for (const r of [excluded, outside, ...(excludeAll ? [selected] : [])]) {
        expect((await detail(r.id)).status).toBe('open')
        expect(await listActivities(r.id)).toHaveLength(0)
      }
    },
  )

  it('matches custom report reasons exactly', async () => {
    const f = await fixture()
    const excludedType = 'example.moderation.reason#custom'
    const [excluded, selected] = await reports([
      { subject: f.account, reasonType: excludedType },
      { subject: f.account, reasonType: `${excludedType}Other` },
    ])
    expect(
      (
        await closeReports({
          subject: f.did,
          excludedReportTypes: [
            excludedType,
            'example.moderation.reason#unused',
          ],
        })
      ).data,
    ).toEqual({ closedCount: 1, reportIds: [selected.id] })
    expect((await detail(excluded.id)).status).toBe('open')
    expect(await listActivities(excluded.id)).toHaveLength(0)
  })
})
