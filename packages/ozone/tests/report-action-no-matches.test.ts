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

    it.each(['ids', 'all'] as const)(
      'retains %s precedence over report types',
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
