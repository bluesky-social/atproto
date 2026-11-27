import { beforeAll, describe, expect, it } from 'vitest'
import { ids } from '@atproto/api'
import type { ModeratorClient, TestNetwork } from '@atproto/dev-env'
import { com, tools } from '../src/lexicons/index.js'
import {
  label,
  setupReportActionMatching,
  takedown,
} from './_report-action-matching.js'

describe('report action matching closure', () => {
  const t = setupReportActionMatching('ozone_report_action_no_matches_closure')
  const { fixture, reports, getReport, activities, state, setStatus } = t
  let mod: ModeratorClient
  let network: TestNetwork

  beforeAll(() => {
    mod = t.mod
    network = t.network
  })

  describe.each(['account', 'record'] as const)('%s', (kind) => {
    describe.each(['types', 'all'] as const)('%s closure', (selector) => {
      const broadSelection = () =>
        selector === 'all'
          ? { all: true, types: [com.atproto.moderation.defs.ReasonSpam] }
          : { types: [com.atproto.moderation.defs.ReasonSpam] }

      it('protects permanent assignments independently of report status', async () => {
        const f = await fixture()
        const [p1, p2, temporary, ended, unassigned, explicit] = await reports([
          f[kind],
          f[kind],
          f[kind],
          f[kind],
          f[kind],
          {
            subject: f[kind],
            reasonType: com.atproto.moderation.defs.ReasonMisleading,
          },
        ])
        const protectedReports = [p1, p2]
        for (const r of protectedReports) {
          await setStatus(r.id, 'assigned')
        }
        await setStatus(protectedReports[0].id, 'queued')
        for (const activity of [
          tools.ozone.report.defs.closeActivity.$build({}),
          tools.ozone.report.defs.reopenActivity.$build({}),
        ]) {
          await mod.agent.tools.ozone.report.createActivity(
            { reportId: protectedReports[1].id, activity },
            {
              headers: await network.ozone.modHeaders(
                ids.ToolsOzoneReportCreateActivity,
              ),
            },
          )
        }
        const before = await Promise.all(
          protectedReports.map(async (r) => ({
            report: await getReport(r.id),
            activities: await activities(r.id),
          })),
        )
        expect(before.map(({ report }) => report.status)).toEqual([
          'queued',
          'open',
        ])

        await mod.agent.tools.ozone.report.assignModerator(
          { reportId: temporary.id },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneReportAssignModerator,
            ),
          },
        )
        await setStatus(ended.id, 'assigned')
        await mod.agent.tools.ozone.report.unassignModerator(
          { reportId: ended.id },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneReportUnassignModerator,
            ),
          },
        )
        await setStatus(explicit.id, 'assigned')
        await setStatus(explicit.id, 'queued')

        const event = await mod.emitEvent({
          subject: f[kind],
          event: label(),
          reportAction: { ...broadSelection(), ids: [explicit.id] },
        })
        for (const r of [temporary, ended, unassigned, explicit]) {
          expect(await getReport(r.id)).toMatchObject({
            status: 'closed',
            actionEventIds: [event.id],
          })
        }
        await mod.emitEvent({
          subject: f[kind],
          event: takedown(),
          reportAction: broadSelection(),
        })
        for (const snapshot of before) {
          expect(await getReport(snapshot.report.id)).toMatchObject({
            status: snapshot.report.status,
            updatedAt: snapshot.report.updatedAt,
            actionEventIds: snapshot.report.actionEventIds,
          })
          expect(await activities(snapshot.report.id)).toEqual(
            snapshot.activities,
          )
        }
      })

      it.each(['assigned', 'escalated'] as const)(
        'includes the explicitly selected %s report and preserves other active reviews',
        async (currentStatus) => {
          const f = await fixture()
          const misleading = com.atproto.moderation.defs.ReasonMisleading
          const [current, open, queued, assigned, escalated, unrelated] =
            await reports([
              { subject: f[kind], reasonType: misleading },
              f[kind],
              f[kind],
              f[kind],
              f[kind],
              { subject: f[kind], reasonType: misleading },
            ])
          await setStatus(current.id, currentStatus)
          await setStatus(queued.id, 'queued')
          await setStatus(assigned.id, 'assigned')
          await setStatus(escalated.id, 'escalated')
          const protectedBefore = await Promise.all(
            [assigned, escalated].map(async (r) => ({
              report: await getReport(r.id),
              activities: await activities(r.id),
            })),
          )
          expect(protectedBefore.map(({ report }) => report.status)).toEqual([
            'assigned',
            'escalated',
          ])
          const previousActivities = await activities(open.id)
          const event = await mod.emitEvent({
            subject: f[kind],
            event: label(),
            reportAction: {
              ...broadSelection(),
              ids: [current.id, open.id, open.id],
              isAutomated: false,
            },
          })
          for (const r of [current, open, queued]) {
            expect(await getReport(r.id)).toMatchObject({
              status: 'closed',
              actionEventIds: [event.id],
            })
          }
          expect((await activities(open.id)).length).toBe(
            previousActivities.length + 1,
          )
          for (const before of protectedBefore) {
            const after = await getReport(before.report.id)
            expect(after.status).toBe(before.report.status)
            expect(after.updatedAt).toBe(before.report.updatedAt)
            expect(after.actionEventIds).toEqual(before.report.actionEventIds)
            expect(await activities(after.id)).toEqual(before.activities)
          }
          expect((await getReport(unrelated.id)).status).toBe(
            selector === 'all' ? 'closed' : 'open',
          )
        },
      )

      it('commits enforcement without closing assigned or escalated matches', async () => {
        const f = await fixture()
        const existing = await reports([f[kind], f[kind]])
        await setStatus(existing[0].id, 'assigned')
        await setStatus(existing[1].id, 'escalated')
        const before = await Promise.all(existing.map((r) => activities(r.id)))
        await mod.emitEvent({
          subject: f[kind],
          event: takedown(),
          reportAction: { ...broadSelection(), isAutomated: true },
        })
        expect((await state(f, kind)).moderation.subjectStatus?.takendown).toBe(
          true,
        )
        for (const [i, r] of existing.entries()) {
          expect((await getReport(r.id)).status).toBe(
            i === 0 ? 'assigned' : 'escalated',
          )
          expect(await activities(r.id)).toEqual(before[i])
        }
      })

      it.each(['missing', 'wrong-subject', 'closed'] as const)(
        'rolls back enforcement for %s explicit IDs despite valid broad matches',
        async (invalid) => {
          const f = await fixture()
          const [matching, selected] = await reports([
            f[kind],
            invalid === 'wrong-subject' ? (await fixture())[kind] : f[kind],
          ])
          if (invalid === 'closed') {
            await mod.emitEvent({
              subject: f[kind],
              event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
              reportAction: { ids: [selected.id] },
            })
          }
          const before = await getReport(matching.id)
          const beforeActivities = await activities(matching.id)
          await expect(
            mod.emitEvent({
              subject: f[kind],
              event: takedown(),
              reportAction: {
                ...broadSelection(),
                ids: [invalid === 'missing' ? 999999999 : selected.id],
              },
            }),
          ).rejects.toThrow(/Report IDs .* do not exist/)
          expect(
            (await state(f, kind)).moderation.subjectStatus?.takendown,
          ).not.toBe(true)
          expect(await getReport(matching.id)).toMatchObject({
            status: before.status,
            actionEventIds: before.actionEventIds,
            updatedAt: before.updatedAt,
          })
          expect(await activities(matching.id)).toEqual(beforeActivities)
        },
      )
    })
  })
})
