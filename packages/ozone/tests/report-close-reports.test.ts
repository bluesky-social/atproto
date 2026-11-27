import { describe, expect, it } from 'vitest'
import { com } from '../src/lexicons/index.js'
import {
  CHAT_CONVO_COLLECTION,
  CHAT_MESSAGE_COLLECTION,
} from '../src/mod-service/subject.js'
import { setupCloseReports } from './_close-reports.js'

describe('report-close-reports', () => {
  const t = setupCloseReports('ozone_report_close_reports')
  const {
    closeReports,
    listActivities,
    fixture,
    reports,
    detail,
    setStatus,
    snapshotReports,
    expectUnchanged,
  } = t

  describe.each(['account', 'record', 'message', 'conversation'] as const)(
    '%s explicitly targeted report',
    (kind) => {
      it('closes the current assigned report and eligible matching reports', async () => {
        const f = await fixture()
        const [
          current,
          matching,
          assigned,
          activeAssignment,
          escalated,
          otherType,
          otherSubject,
        ] = await reports([
          {
            subject: f[kind],
            reasonType: com.atproto.moderation.defs.ReasonRude,
          },
          f[kind],
          f[kind],
          f[kind],
          f[kind],
          {
            subject: f[kind],
            reasonType: com.atproto.moderation.defs.ReasonRude,
          },
          kind === 'account' ? f.record : f.account,
        ])
        await setStatus(current.id, 'assigned')
        await setStatus(assigned.id, 'assigned')
        await setStatus(activeAssignment.id, 'assigned')
        await setStatus(activeAssignment.id, 'queued')
        await setStatus(escalated.id, 'escalated')
        const before = await snapshotReports([
          assigned,
          activeAssignment,
          escalated,
          otherType,
          otherSubject,
        ])
        const subject =
          kind === 'account'
            ? f.did
            : kind === 'record'
              ? f.record.uri
              : `at://${f.did}/${kind === 'message' ? CHAT_MESSAGE_COLLECTION : CHAT_CONVO_COLLECTION}/${kind === 'message' ? f.message.messageId : f.conversation.convoId}`
        const input = {
          subject,
          reportId: current.id,
          reportTypes: [com.atproto.moderation.defs.ReasonSpam],
          internalNote: 'reviewed',
        }

        expect((await closeReports(input)).data).toEqual({
          closedCount: 2,
          reportIds: [current.id, matching.id],
        })
        for (const r of [current, matching]) {
          expect((await detail(r.id)).status).toBe('closed')
          expect(await listActivities(r.id)).toContainEqual(
            expect.objectContaining({
              internalNote: 'reviewed',
              meta: { resolution: 'noAction' },
            }),
          )
        }
        await expectUnchanged(before)
        expect((await closeReports(input)).data).toEqual({
          closedCount: 0,
          reportIds: [],
        })
      })
    },
  )

  it.each([false, true])(
    'closes the current report with all eligible reports when includeAllOwned is %s',
    async (includeAllOwned) => {
      const f = await fixture()
      const [current, otherAccount, record, protectedRecord] = await reports([
        f.account,
        f.account,
        f.record,
        f.record,
      ])
      await setStatus(current.id, 'assigned')
      await setStatus(protectedRecord.id, 'assigned')

      const { data } = await closeReports({
        subject: f.did,
        reportId: current.id,
        includeAllOwned,
      })
      expect(data).toEqual({
        closedCount: includeAllOwned ? 3 : 2,
        reportIds: includeAllOwned
          ? [current.id, otherAccount.id, record.id]
          : [current.id, otherAccount.id],
      })
      expect((await detail(current.id)).status).toBe('closed')
      expect((await detail(protectedRecord.id)).status).toBe('assigned')
      expect((await detail(record.id)).status).toBe(
        includeAllOwned ? 'closed' : 'open',
      )
    },
  )

  it('does not allow an explicit report outside the subject scope or excluded types', async () => {
    const f = await fixture()
    const [outside, excluded] = await reports([
      f.record,
      {
        subject: f.account,
        reasonType: com.atproto.moderation.defs.ReasonRude,
      },
    ])
    await setStatus(outside.id, 'assigned')
    await setStatus(excluded.id, 'escalated')
    const before = await snapshotReports([outside, excluded])

    expect(
      (
        await closeReports({
          subject: f.did,
          reportId: outside.id,
          reportTypes: [com.atproto.moderation.defs.ReasonSpam],
        })
      ).data,
    ).toEqual({ closedCount: 0, reportIds: [] })
    expect(
      (
        await closeReports({
          subject: f.did,
          reportId: excluded.id,
          excludedReportTypes: [com.atproto.moderation.defs.ReasonRude],
        })
      ).data,
    ).toEqual({ closedCount: 0, reportIds: [] })
    await expectUnchanged(before)

    expect(
      (await closeReports({ subject: f.did, reportId: excluded.id })).data,
    ).toEqual({
      closedCount: 1,
      reportIds: [excluded.id],
    })
  })

  it.each([undefined, false])(
    'keeps account closure exact when includeAllOwned is %s',
    async (includeAllOwned) => {
      const f = await fixture()
      const [selected, ...untouched] = await reports([
        f.account,
        f.record,
        f.message,
        f.conversation,
      ])
      expect(
        (await closeReports({ subject: f.did, includeAllOwned })).data,
      ).toEqual({ closedCount: 1, reportIds: [selected.id] })
      for (const r of untouched)
        expect((await detail(r.id)).status).toBe('open')
    },
  )

  it.each([undefined, false])(
    'keeps record closure exact when includeAllOwned is %s',
    async (includeAllOwned) => {
      const f = await fixture()
      const [selected, ...untouched] = await reports([
        f.record,
        f.account,
        f.message,
        f.conversation,
      ])
      expect(
        (await closeReports({ subject: f.record.uri, includeAllOwned })).data,
      ).toEqual({ closedCount: 1, reportIds: [selected.id] })
      for (const r of untouched)
        expect((await detail(r.id)).status).toBe('open')
    },
  )

  it('closes every same-DID subject from an account input and isolates shared chat IDs', async () => {
    const f = await fixture()
    const foreign = await fixture()
    const created = await reports([
      f.account,
      f.record,
      f.message,
      f.conversation,
      foreign.account,
      foreign.record,
      foreign.message,
      foreign.conversation,
    ])
    const selected = created.slice(0, 4)
    const untouched = created.slice(4)
    const input = {
      subject: f.did,
      includeAllOwned: true,
      internalNote: 'Reports reviewed',
      isAutomated: true,
    }
    const { data } = await closeReports(input)
    expect(data.closedCount).toBe(selected.length)
    expect(data.reportIds.sort()).toEqual(selected.map((r) => r.id).sort())
    for (const r of selected) {
      const view = await detail(r.id)
      expect(view.status).toBe('closed')
      expect(view.actionEventIds ?? []).toEqual([])
      expect(await listActivities(r.id)).toEqual([
        expect.objectContaining({
          internalNote: 'Reports reviewed',
          isAutomated: true,
        }),
      ])
    }
    for (const r of untouched) {
      expect((await detail(r.id)).status).toBe('open')
      expect(await listActivities(r.id)).toHaveLength(0)
    }
    expect((await closeReports(input)).data).toEqual({
      closedCount: 0,
      reportIds: [],
    })
  })

  it.each(['record', 'message', 'conversation'] as const)(
    'rejects includeAllOwned for a %s AT-URI without closing any reports',
    async (kind) => {
      const f = await fixture()
      const [selected, ...untouched] = await reports([
        f[kind],
        ...[f.account, f.record, f.message, f.conversation].filter(
          (subject) => subject !== f[kind],
        ),
      ])
      const subject =
        kind === 'record'
          ? f.record.uri
          : kind === 'message'
            ? `at://${f.did}/${CHAT_MESSAGE_COLLECTION}/${f.message.messageId}`
            : `at://${f.did}/${CHAT_CONVO_COLLECTION}/${f.conversation.convoId}`
      await expect(
        closeReports({ subject, includeAllOwned: true }),
      ).rejects.toMatchObject({
        error: 'InvalidRequest',
        message: 'includeAllOwned is only valid for account subjects',
      })
      for (const r of [selected, ...untouched]) {
        expect((await detail(r.id)).status).toBe('open')
        expect(await listActivities(r.id)).toHaveLength(0)
      }
      expect(
        (await closeReports({ subject, includeAllOwned: false })).data,
      ).toEqual({ closedCount: 1, reportIds: [selected.id] })
      for (const r of untouched)
        expect((await detail(r.id)).status).toBe('open')
    },
  )
})
