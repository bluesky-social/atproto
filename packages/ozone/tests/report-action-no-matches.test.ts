import { ids } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { com, tools } from '../src/lexicons/index.js'
import { reportForEvent } from './_inbox.js'

describe('report action matching', () => {
  let network: TestNetwork
  let sc: SeedClient
  let mod: ModeratorClient
  let fixtureNumber = 0

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_action_no_matches',
    })
    sc = network.getSeedClient()
    mod = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => network?.close())

  async function fixture() {
    const name = `matching${++fixtureNumber}`
    const { did } = await sc.createAccount(name, {
      handle: `${name}.test`,
      email: `${name}@example.com`,
      password: 'password',
    })
    const post = await sc.post(did, 'Example post')
    await network.processAll()
    return {
      did,
      account: com.atproto.admin.defs.repoRef.$build({ did }),
      record: com.atproto.repo.strongRef.$build({
        uri: post.ref.uriStr,
        cid: post.ref.cidStr,
      }),
    }
  }

  type Subject = Parameters<ModeratorClient['emitEvent']>[0]['subject']

  async function report(
    subject: Subject,
    reasonType: string = com.atproto.moderation.defs.ReasonSpam,
  ) {
    const event = await sc.createReport({
      subject,
      reasonType,
      reportedBy: sc.dids.bob,
    })
    await network.processAll()
    return reportForEvent(mod, event.id)
  }

  async function activities(reportId?: number) {
    if (reportId !== undefined) {
      const { data } = await mod.agent.tools.ozone.report.listActivities(
        { reportId },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneReportListActivities,
          ),
        },
      )
      return data.activities.map(({ id }) => id)
    }
    const { data } = await mod.agent.tools.ozone.report.queryActivities(
      { limit: 100 },
      {
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneReportQueryActivities,
        ),
      },
    )
    return data.activities.map(({ id }) => id)
  }

  async function state(
    f: Awaited<ReturnType<typeof fixture>>,
    kind: 'account' | 'record',
  ) {
    if (kind === 'account') {
      return (
        await mod.agent.tools.ozone.moderation.getRepo(
          { did: f.did },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneModerationGetRepo,
            ),
          },
        )
      ).data
    }
    return (
      await mod.agent.tools.ozone.moderation.getRecord(
        { uri: f.record.uri },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneModerationGetRecord,
          ),
        },
      )
    ).data
  }

  const takedown = () => tools.ozone.moderation.defs.modEventTakedown.$build({})
  const label = () =>
    tools.ozone.moderation.defs.modEventLabel.$build({
      createLabelVals: ['spam'],
      negateLabelVals: [],
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
          const before =
            existing && (await reportForEvent(mod, existing.eventId))
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
            const after = await reportForEvent(mod, existing!.eventId)
            expect(after.status).toBe('closed')
            expect(after.actionEventIds).toEqual([event.id])
          } else {
            expect(await activities()).toEqual(activityIds)
            if (existing) {
              const after = await reportForEvent(mod, existing.eventId)
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
        const before = await reportForEvent(mod, existing.eventId)
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
        const after = await reportForEvent(mod, existing.eventId)
        expect(after.status).toBe(before.status)
        expect(after.actionEventIds).toEqual(before.actionEventIds)
        expect(await activities(existing.id)).toEqual(activityIds)
      },
    )

    async function setStatus(
      reportId: number,
      status: 'queued' | 'assigned' | 'escalated',
    ) {
      if (status === 'assigned') {
        await mod.agent.tools.ozone.report.assignModerator(
          {
            reportId,
            did: network.ozone.moderatorAccnt.did,
            isPermanent: true,
          },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneReportAssignModerator,
              'admin',
            ),
          },
        )
      } else {
        await mod.agent.tools.ozone.report.createActivity(
          {
            reportId,
            activity:
              status === 'queued'
                ? tools.ozone.report.defs.queueActivity.$build({})
                : tools.ozone.report.defs.escalationActivity.$build({}),
          },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneReportCreateActivity,
            ),
          },
        )
      }
    }

    it('preserves explicit-ID precedence for escalation', async () => {
      const f = await fixture()
      const selected = await report(
        f[kind],
        com.atproto.moderation.defs.ReasonMisleading,
      )
      const other = await report(f[kind])
      const event = await mod.emitEvent({
        subject: f[kind],
        event: tools.ozone.moderation.defs.modEventEscalate.$build({}),
        reportAction: {
          ids: [selected.id],
          types: [com.atproto.moderation.defs.ReasonSpam],
        },
      })
      expect(await reportForEvent(mod, selected.eventId)).toMatchObject({
        status: 'escalated',
        actionEventIds: [event.id],
      })
      expect(await reportForEvent(mod, other.eventId)).toMatchObject({
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
        expect(await reportForEvent(mod, current.eventId)).toMatchObject({
          status: 'closed',
          actionEventIds: [event.id],
        })
      },
    )

    describe.each(['types', 'all'] as const)('%s closure', (selector) => {
      const broadSelection = () =>
        selector === 'all'
          ? { all: true, types: [com.atproto.moderation.defs.ReasonSpam] }
          : { types: [com.atproto.moderation.defs.ReasonSpam] }

      it('protects permanent assignments independently of report status', async () => {
        const f = await fixture()
        const protectedReports = [await report(f[kind]), await report(f[kind])]
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
            report: await reportForEvent(mod, r.eventId),
            activities: await activities(r.id),
          })),
        )
        expect(before.map(({ report }) => report.status)).toEqual([
          'queued',
          'open',
        ])

        const temporary = await report(f[kind])
        await mod.agent.tools.ozone.report.assignModerator(
          { reportId: temporary.id },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneReportAssignModerator,
            ),
          },
        )
        const ended = await report(f[kind])
        await setStatus(ended.id, 'assigned')
        await mod.agent.tools.ozone.report.unassignModerator(
          { reportId: ended.id },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneReportUnassignModerator,
            ),
          },
        )
        const unassigned = await report(f[kind])
        const explicit = await report(
          f[kind],
          com.atproto.moderation.defs.ReasonMisleading,
        )
        await setStatus(explicit.id, 'assigned')
        await setStatus(explicit.id, 'queued')

        const event = await mod.emitEvent({
          subject: f[kind],
          event: label(),
          reportAction: { ...broadSelection(), ids: [explicit.id] },
        })
        for (const r of [temporary, ended, unassigned, explicit]) {
          expect(await reportForEvent(mod, r.eventId)).toMatchObject({
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
          expect(
            await reportForEvent(mod, snapshot.report.eventId),
          ).toMatchObject({
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
          const current = await report(
            f[kind],
            com.atproto.moderation.defs.ReasonMisleading,
          )
          await setStatus(current.id, currentStatus)
          const open = await report(f[kind])
          const queued = await report(f[kind])
          await setStatus(queued.id, 'queued')
          const assigned = await report(f[kind])
          await setStatus(assigned.id, 'assigned')
          const escalated = await report(f[kind])
          await setStatus(escalated.id, 'escalated')
          const unrelated = await report(
            f[kind],
            com.atproto.moderation.defs.ReasonMisleading,
          )
          const protectedBefore = await Promise.all(
            [assigned, escalated].map(async (r) => ({
              report: await reportForEvent(mod, r.eventId),
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
            expect(await reportForEvent(mod, r.eventId)).toMatchObject({
              status: 'closed',
              actionEventIds: [event.id],
            })
          }
          expect((await activities(open.id)).length).toBe(
            previousActivities.length + 1,
          )
          for (const before of protectedBefore) {
            const after = await reportForEvent(mod, before.report.eventId)
            expect(after.status).toBe(before.report.status)
            expect(after.updatedAt).toBe(before.report.updatedAt)
            expect(after.actionEventIds).toEqual(before.report.actionEventIds)
            expect(await activities(after.id)).toEqual(before.activities)
          }
          expect((await reportForEvent(mod, unrelated.eventId)).status).toBe(
            selector === 'all' ? 'closed' : 'open',
          )
        },
      )

      it('commits enforcement without closing assigned or escalated matches', async () => {
        const f = await fixture()
        const existing = [await report(f[kind]), await report(f[kind])]
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
          expect((await reportForEvent(mod, r.eventId)).status).toBe(
            i === 0 ? 'assigned' : 'escalated',
          )
          expect(await activities(r.id)).toEqual(before[i])
        }
      })

      it.each(['missing', 'wrong-subject', 'closed'] as const)(
        'rolls back enforcement for %s explicit IDs despite valid broad matches',
        async (invalid) => {
          const f = await fixture()
          const matching = await report(f[kind])
          const selected = await report(
            invalid === 'wrong-subject' ? (await fixture())[kind] : f[kind],
          )
          if (invalid === 'closed') {
            await mod.emitEvent({
              subject: f[kind],
              event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
              reportAction: { ids: [selected.id] },
            })
          }
          const before = await reportForEvent(mod, matching.eventId)
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
          expect(await reportForEvent(mod, matching.eventId)).toMatchObject({
            status: before.status,
            actionEventIds: before.actionEventIds,
            updatedAt: before.updatedAt,
          })
          expect(await activities(matching.id)).toEqual(beforeActivities)
        },
      )
    })

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
        const after = await reportForEvent(mod, existing.eventId)
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
    const after = await reportForEvent(mod, existing.eventId)
    expect(after.status).toBe(existing.status)
    expect(after.actionEventIds).toEqual(existing.actionEventIds)
    expect(await activities(existing.id)).toEqual(activityIds)
  })
})
