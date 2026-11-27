import type { ModeratorClient } from '@atproto/dev-env'
import { com, tools } from '../src/lexicons/index.js'
import {
  label,
  setupReportActionMatching,
  takedown,
} from './_report-action-matching.js'

describe('report action matching', () => {
  const t = setupReportActionMatching('ozone_report_action_no_matches')
  const { fixture, reports, report, getReport, activities, state, setStatus } =
    t
  let mod: ModeratorClient

  beforeAll(() => {
    mod = t.mod
  })

  describe.each(['account', 'record'] as const)('%s', (kind) => {
    describe.each(['takedown', 'label'] as const)('%s', (action) => {
      it.each(['none', 'unrelated', 'closed', 'matching'] as const)(
        'commits enforcement with %s reports',
        async (reportState) => {
          const f = await fixture()
          const subject = f[kind]
          const subjectUri = kind === 'account' ? f.did : f.record.uri
          const existing =
            reportState === 'none'
              ? undefined
              : await report(
                  subject,
                  reportState === 'unrelated'
                    ? com.atproto.moderation.defs.ReasonMisleading
                    : com.atproto.moderation.defs.ReasonSpam,
                )
          if (reportState === 'closed') {
            await mod.emitEvent({
              subject,
              event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
              reportAction: { ids: [existing!.id] },
            })
          }
          const before = existing && (await getReport(existing.id))
          const activityIds = await activities()
          const event = await mod.emitEvent({
            subject,
            event: action === 'takedown' ? takedown() : label(),
            reportAction: {
              types: [com.atproto.moderation.defs.ReasonSpam],
              isAutomated: true,
            },
          })
          const history = await mod.queryEvents({
            subject: subjectUri,
            types: [event.event.$type],
          })
          expect(history.events.map(({ id }) => id)).toEqual([event.id])
          const view = await state(f, kind)
          if (action === 'takedown') {
            expect(view.moderation.subjectStatus?.takendown).toBe(true)
          } else {
            expect(view.labels?.map(({ val }) => val)).toContain('spam')
          }
          if (reportState === 'matching') {
            const after = await getReport(existing!.id)
            expect(after.status).toBe('closed')
            expect(after.actionEventIds).toEqual([event.id])
          } else {
            expect(await activities()).toEqual(activityIds)
            if (existing) {
              const after = await getReport(existing.id)
              expect(after.status).toBe(before!.status)
              expect(after.actionEventIds).toEqual(before!.actionEventIds)
              expect(after.updatedAt).toBe(before!.updatedAt)
            } else {
              for (const status of ['open', 'closed']) {
                expect(
                  (await mod.queryReports({ subject: subjectUri, status }))
                    .reports,
                ).toEqual([])
              }
            }
          }
        },
      )
    })

    it.each([
      'missing',
      'wrong-subject',
      'closed',
      'partially-missing',
    ] as const)(
      'rejects %s explicit report IDs even with types',
      async (reportState) => {
        const f = await fixture()
        const subject = f[kind]
        const target =
          reportState === 'wrong-subject' ? (await fixture())[kind] : subject
        const existing = await report(target)
        if (reportState === 'closed') {
          await mod.emitEvent({
            subject,
            event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
            reportAction: { ids: [existing.id] },
          })
        }
        const selectedIds =
          reportState === 'missing'
            ? [999999999]
            : reportState === 'partially-missing'
              ? [existing.id, 999999999]
              : [existing.id]
        const before = await getReport(existing.id)
        const activityIds = await activities(existing.id)
        await expect(
          mod.emitEvent({
            subject,
            event: takedown(),
            reportAction: {
              ids: selectedIds,
              types: [com.atproto.moderation.defs.ReasonSpam],
            },
          }),
        ).rejects.toThrow(
          /No matching reports found|Report IDs .* do not exist/,
        )
        expect(
          (
            await mod.queryEvents({
              subject: kind === 'account' ? f.did : f.record.uri,
              types: [tools.ozone.moderation.defs.modEventTakedown.$type],
            })
          ).events,
        ).toEqual([])
        expect(
          (await state(f, kind)).moderation.subjectStatus?.takendown,
        ).not.toBe(true)
        const after = await getReport(existing.id)
        expect(after.status).toBe(before.status)
        expect(after.actionEventIds).toEqual(before.actionEventIds)
        expect(await activities(existing.id)).toEqual(activityIds)
      },
    )

    it('preserves explicit-ID precedence for escalation', async () => {
      const f = await fixture()
      const [selected, other] = await reports([
        {
          subject: f[kind],
          reasonType: com.atproto.moderation.defs.ReasonMisleading,
        },
        f[kind],
      ])
      const event = await mod.emitEvent({
        subject: f[kind],
        event: tools.ozone.moderation.defs.modEventEscalate.$build({}),
        reportAction: {
          ids: [selected.id],
          types: [com.atproto.moderation.defs.ReasonSpam],
        },
      })
      expect(await getReport(selected.id)).toMatchObject({
        status: 'escalated',
        actionEventIds: [event.id],
      })
      expect(await getReport(other.id)).toMatchObject({
        status: other.status,
        actionEventIds: other.actionEventIds,
        updatedAt: other.updatedAt,
      })
    })

    it.each(['assigned', 'escalated'] as const)(
      'closes an explicitly selected %s report without broad selectors',
      async (status) => {
        const f = await fixture()
        const current = await report(f[kind])
        await setStatus(current.id, status)
        const event = await mod.emitEvent({
          subject: f[kind],
          event: label(),
          reportAction: { ids: [current.id] },
        })
        expect(await getReport(current.id)).toMatchObject({
          status: 'closed',
          actionEventIds: [event.id],
        })
      },
    )

    it.each(['ids', 'all'] as const)(
      'includes an unrelated reason explicitly selected by %s',
      async (selector) => {
        const f = await fixture()
        const subject = f[kind]
        const existing = await report(
          subject,
          com.atproto.moderation.defs.ReasonMisleading,
        )
        const event = await mod.emitEvent({
          subject,
          event: label(),
          reportAction: {
            types: [com.atproto.moderation.defs.ReasonSpam],
            ...(selector === 'ids' ? { ids: [existing.id] } : { all: true }),
          },
        })
        const after = await getReport(existing.id)
        expect(after.status).toBe('closed')
        expect(after.actionEventIds).toEqual([event.id])
      },
    )
  })

  it('leaves matching reports on owned records open during account enforcement', async () => {
    const f = await fixture()
    const existing = await report(f.record)
    const activityIds = await activities(existing.id)
    await mod.emitEvent({
      subject: f.account,
      event: takedown(),
      reportAction: { types: [com.atproto.moderation.defs.ReasonSpam] },
    })
    const after = await getReport(existing.id)
    expect(after.status).toBe(existing.status)
    expect(after.actionEventIds).toEqual(existing.actionEventIds)
    expect(await activities(existing.id)).toEqual(activityIds)
  })
})
