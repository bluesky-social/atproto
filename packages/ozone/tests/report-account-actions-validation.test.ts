import { ids } from '@atproto/api'
import type { ModeratorClient, TestNetwork } from '@atproto/dev-env'
import { chat, com, tools } from '../src/lexicons/index.js'
import { label, setupAccountActions, takedown } from './_account-actions.js'

describe('report linkage validation between accounts and content', () => {
  const t = setupAccountActions('ozone_report_account_actions_validation')
  const { fixture, reports, report, detail, activities, snapshots } = t
  let mod: ModeratorClient
  let network: TestNetwork

  beforeAll(() => {
    mod = t.mod
    network = t.network
  })

  it.each(['record', 'message', 'conversation'] as const)(
    'rejects expanded report targeting on a %s event',
    async (kind) => {
      const f = await fixture()
      const subject = kind === 'record' ? f.records[0] : f[kind]
      const current = await report(subject)
      const before = await detail(current.id)
      const targets = [
        f.account,
        f.records[1],
        ...(kind !== 'message' ? [f.message] : []),
        ...(kind !== 'conversation' ? [f.conversation] : []),
      ]
      for (const target of targets) {
        await expect(
          mod.emitEvent({
            subject,
            event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
            reportAction: { subjects: [target], ids: [current.id], all: true },
          }),
        ).rejects.toThrow('additional report subjects require an account event')
      }
      for (const type of [
        'account',
        'record',
        'message',
        'conversation',
      ] as const) {
        await expect(
          mod.emitEvent({
            subject,
            event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
            reportAction: {
              subjectTypes: [type],
              ids: [current.id],
              all: true,
            },
          }),
        ).rejects.toThrow('additional report subjects require an account event')
      }
      expect(await detail(current.id)).toEqual(before)
      expect(await activities(current.id)).toEqual([])
    },
  )

  it.each(['account', 'record', 'message', 'conversation'] as const)(
    'rejects a foreign %s subject without applying enforcement or closing reports',
    async (kind) => {
      const f = await fixture()
      const other = await fixture()
      const subject = kind === 'record' ? other.records[0] : other[kind]
      const created = await reports([f.account, f.records[0]])
      const before = await snapshots(created)
      await expect(
        mod.emitEvent({
          subject: f.account,
          event: label(),
          reportAction: { subjects: [f.records[0], subject], all: true },
        }),
      ).rejects.toThrow('report subjects must belong to the actioned account')
      expect(await snapshots(created)).toEqual(before)
      expect(
        (
          await mod.queryEvents({
            subject: f.did,
            types: [tools.ozone.moderation.defs.modEventLabel.$type],
          })
        ).events,
      ).toEqual([])
    },
  )

  it('preserves explicit owned-record IDs when subjects only repeats the current account', async () => {
    const f = await fixture()
    const selected = await report(f.records[0])
    const event = await mod.emitEvent({
      subject: f.account,
      event: label(),
      reportAction: { subjects: [f.account], ids: [selected.id] },
    })
    expect(await detail(selected.id)).toMatchObject({
      status: 'closed',
      actionEventIds: [event.id],
    })
  })

  it('allows repeating the current subject on events that do not close reports', async () => {
    const f = await fixture()
    const selected = await report(f.records[0])
    await mod.emitEvent({
      subject: f.records[0],
      event: tools.ozone.moderation.defs.modEventEscalate.$build({}),
      reportAction: { subjects: [f.records[0]], ids: [selected.id] },
    })
    expect((await detail(selected.id)).status).toBe('escalated')
  })

  describe.each(['subjects', 'subjectTypes'] as const)(
    '%s validation',
    (field) => {
      it.each(['not-a-list', 'unsupported', 'too-many'] as const)(
        'rejects %s values before applying an event',
        async (kind) => {
          const f = await fixture()
          const selected = await report(f.account)
          const before = await detail(selected.id)
          const targets =
            field === 'subjectTypes'
              ? kind === 'not-a-list'
                ? 'record'
                : kind === 'too-many'
                  ? Array.from({ length: 5 }, () => 'record')
                  : ['unsupported']
              : kind === 'not-a-list'
                ? f.records[0]
                : kind === 'too-many'
                  ? Array.from({ length: 101 }, () => f.records[0])
                  : [{ $type: 'unsupported', uri: f.records[0].uri }]
          const response = await fetch(
            `${network.ozone.url}/xrpc/${tools.ozone.moderation.emitEvent.$lxm}`,
            {
              method: 'POST',
              headers: {
                ...(await network.ozone.modHeaders(
                  tools.ozone.moderation.emitEvent.$lxm,
                )),
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                createdBy: network.ozone.moderatorAccnt.did,
                subject: f.account,
                event: label(),
                reportAction: { [field]: targets, all: true },
              }),
            },
          )
          expect(response.status).toBe(400)
          expect(await response.json()).toMatchObject({
            error: 'InvalidRequest',
          })
          expect(await detail(selected.id)).toEqual(before)
          expect(
            (
              await mod.queryEvents({
                subject: f.did,
                types: [tools.ozone.moderation.defs.modEventLabel.$type],
              })
            ).events,
          ).toEqual([])
        },
      )
    },
  )

  it.each(['outside-scope', 'foreign', 'missing', 'closed'] as const)(
    'rolls back account enforcement and report updates for a %s ID',
    async (invalid) => {
      const f = await fixture()
      const [s1, s2, other] = await reports([
        f.account,
        f.records[0],
        invalid === 'foreign'
          ? (await fixture()).account
          : invalid === 'outside-scope'
            ? f.message
            : f.records[1],
      ])
      const selected = [s1, s2]
      if (invalid === 'closed') {
        await mod.emitEvent({
          subject: f.records[1],
          event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
          reportAction: { ids: [other.id] },
        })
      }
      const before = await Promise.all(
        [...selected, other].map((r) => detail(r.id)),
      )
      const history = await Promise.all(selected.map((r) => activities(r.id)))
      await expect(
        mod.emitEvent({
          subject: f.account,
          event: label(),
          reportAction: {
            subjects: [f.records[0]],
            all: true,
            ids: [selected[0].id, invalid === 'missing' ? 999999999 : other.id],
          },
        }),
      ).rejects.toThrow(/Report IDs .* do not exist/)
      expect(
        await Promise.all([...selected, other].map((r) => detail(r.id))),
      ).toEqual(before)
      expect(await Promise.all(selected.map((r) => activities(r.id)))).toEqual(
        history,
      )
      expect(
        (
          await mod.queryEvents({
            subject: f.did,
            types: [tools.ozone.moderation.defs.modEventLabel.$type],
          })
        ).events,
      ).toEqual([])
    },
  )

  it('rejects explicit message reports from another conversation', async () => {
    const f = await fixture()
    const [account, current, other] = await reports([
      f.account,
      f.message,
      chat.bsky.convo.defs.messageRef.$build({
        ...f.message,
        convoId: 'other-conversation',
      }),
    ])
    const before = await snapshots([account, current, other])
    await expect(
      mod.emitEvent({
        subject: f.message,
        event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
        reportAction: {
          subjects: [f.message],
          all: true,
          ids: [other.id],
        },
      }),
    ).rejects.toThrow(/Report IDs .* do not exist/)
    expect(await snapshots([account, current, other])).toEqual(before)
    expect(await activities(account.id)).toEqual([])
  })

  it.each([false, true])(
    'rejects both expansion fields even when empty with allOwned=%s',
    async (allOwned) => {
      const f = await fixture()
      const current = await report(f.account)
      const before = await detail(current.id)
      const eventsBefore = (await mod.queryEvents({ subject: f.did })).events
      const selections: tools.ozone.moderation.emitEvent.ReportAction[] = [
        { subjects: [], subjectTypes: [] },
        { subjects: [], subjectTypes: ['record'] },
        { subjects: [f.records[0]], subjectTypes: [] },
        { subjects: [f.records[0]], subjectTypes: ['record'] },
      ]
      for (const selection of selections) {
        await expect(
          mod.emitEvent({
            subject: f.account,
            event: label(),
            reportAction: { ...selection, all: true, allOwned },
          }),
        ).rejects.toThrow(
          'reportAction subjects and subjectTypes are mutually exclusive',
        )
      }
      expect(await detail(current.id)).toEqual(before)
      expect((await mod.queryEvents({ subject: f.did })).events).toEqual(
        eventsBefore,
      )
    },
  )

  it('allows account-only subjectTypes on events that do not close reports', async () => {
    const f = await fixture()
    const [selected, untouched] = await reports([f.account, f.records[0]])
    const before = await detail(untouched.id)
    await mod.emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventEscalate.$build({}),
      reportAction: { subjectTypes: ['account'], ids: [selected.id] },
    })
    expect((await detail(selected.id)).status).toBe('escalated')
    expect(await detail(untouched.id)).toEqual(before)
  })

  it('requires a closing event for extra subjects and a report selector', async () => {
    const f = await fixture()
    const invalidInputs: (Parameters<ModeratorClient['emitEvent']>[0] & {
      message: string
    })[] = [
      {
        subject: f.account,
        event: tools.ozone.moderation.defs.modEventEscalate.$build({}),
        reportAction: { subjects: [f.records[0]], all: true },
        message:
          'additional report subjects require an event that closes reports',
      },
      {
        subject: f.account,
        event: label(),
        reportAction: { subjects: [f.records[0]] },
        message: 'reportAction must specify ids, types, all, or allOwned',
      },
      {
        subject: f.account,
        event: tools.ozone.moderation.defs.modEventEscalate.$build({}),
        reportAction: { subjectTypes: ['record'], all: true },
        message:
          'additional report subjects require an event that closes reports',
      },
      {
        subject: f.account,
        event: label(),
        reportAction: { subjectTypes: ['record'] },
        message: 'reportAction must specify ids, types, all, or allOwned',
      },
    ]
    for (const { message, ...input } of invalidInputs) {
      await expect(mod.emitEvent(input)).rejects.toThrow(message)
    }
    expect((await mod.queryEvents({ subject: f.did })).events).toEqual([])
  })

  it.each(['label', 'takedown'] as const)(
    'links an account %s only to selected owned record reports',
    async (kind) => {
      const f = await fixture()
      const other = await fixture()
      const [selected, ...untouched] = await reports([
        f.records[0],
        f.records[0],
        f.records[1],
        f.account,
        other.records[0],
      ])
      const before = await Promise.all(untouched.map((r) => detail(r.id)))
      const event = await mod.emitEvent({
        subject: f.account,
        event: kind === 'label' ? label() : takedown(),
        reportAction: { ids: [selected.id, selected.id], note: 'Reviewed' },
      })
      expect(await detail(selected.id)).toMatchObject({
        status: 'closed',
        actionEventIds: [event.id],
        actionNote: 'Reviewed',
      })
      expect(await activities(selected.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            activity: expect.objectContaining({
              $type: tools.ozone.report.defs.closeActivity.$type,
              previousStatus: 'open',
            }),
            meta: expect.objectContaining({
              resolution: 'linked',
              actionEventId: event.id,
            }),
          }),
        ]),
      )
      expect(await Promise.all(untouched.map((r) => detail(r.id)))).toEqual(
        before,
      )
      const history = await mod.queryEvents({
        subject: f.did,
        types: [event.event.$type],
      })
      expect(history.events.map(({ id }) => id)).toEqual([event.id])
      const { data: repo } = await mod.agent.tools.ozone.moderation.getRepo(
        { did: f.did },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneModerationGetRepo,
          ),
        },
      )
      if (kind === 'takedown') {
        expect(repo.moderation.subjectStatus?.takendown).toBe(true)
      } else {
        expect(repo.labels?.map(({ val }) => val)).toContain('spam')
      }
    },
  )

  it.each(['types', 'all'] as const)(
    'keeps broad %s account-scoped when explicit record IDs are present',
    async (selector) => {
      const f = await fixture()
      const [selected, account, ...untouched] = await reports([
        {
          subject: f.records[0],
          reasonType: com.atproto.moderation.defs.ReasonMisleading,
        },
        f.account,
        f.records[0],
        f.records[1],
      ])
      const before = await Promise.all(untouched.map((r) => detail(r.id)))
      const event = await mod.emitEvent({
        subject: f.account,
        event: label(),
        reportAction: {
          ids: [selected.id],
          ...(selector === 'all'
            ? { all: true }
            : { types: [com.atproto.moderation.defs.ReasonSpam] }),
        },
      })
      for (const r of [selected, account]) {
        expect(await detail(r.id)).toMatchObject({
          status: 'closed',
          actionEventIds: [event.id],
        })
      }
      expect(await Promise.all(untouched.map((r) => detail(r.id)))).toEqual(
        before,
      )
    },
  )

  it.each(['assigned', 'escalated'] as const)(
    'closes explicitly selected %s content reports with account enforcement',
    async (status) => {
      const f = await fixture()
      const selected = await report(f.records[0])
      if (status === 'assigned') {
        await mod.agent.tools.ozone.report.assignModerator(
          {
            reportId: selected.id,
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
            reportId: selected.id,
            activity: tools.ozone.report.defs.escalationActivity.$build({}),
          },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneReportCreateActivity,
            ),
          },
        )
      }
      const event = await mod.emitEvent({
        subject: f.account,
        event: label(),
        reportAction: { ids: [selected.id] },
      })
      expect(await detail(selected.id)).toMatchObject({
        status: 'closed',
        actionEventIds: [event.id],
      })
    },
  )

  it.each(['foreign', 'missing', 'closed'] as const)(
    'rolls back account enforcement and every report update for mixed %s IDs',
    async (invalid) => {
      const f = await fixture()
      const created = await reports([
        f.records[0],
        f.account,
        invalid === 'foreign' ? (await fixture()).records[0] : f.records[1],
      ])
      const [selected, , other] = created
      if (invalid === 'closed') {
        await mod.emitEvent({
          subject: f.records[1],
          event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
          reportAction: { ids: [other.id] },
        })
      }
      const before = await Promise.all(created.map((r) => detail(r.id)))
      const history = await Promise.all(created.map((r) => activities(r.id)))
      await expect(
        mod.emitEvent({
          subject: f.account,
          event: takedown(),
          reportAction: {
            ids: [selected.id, invalid === 'missing' ? 999999999 : other.id],
            all: true,
          },
        }),
      ).rejects.toThrow(/Report IDs .* do not exist/)
      expect(await Promise.all(created.map((r) => detail(r.id)))).toEqual(
        before,
      )
      expect(await Promise.all(created.map((r) => activities(r.id)))).toEqual(
        history,
      )
      expect(
        (
          await mod.queryEvents({
            subject: f.did,
            types: [tools.ozone.moderation.defs.modEventTakedown.$type],
          })
        ).events,
      ).toEqual([])
      const { data } = await mod.agent.tools.ozone.moderation.getRepo(
        { did: f.did },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneModerationGetRepo,
          ),
        },
      )
      expect(data.moderation.subjectStatus?.takendown).not.toBe(true)
    },
  )

  it.each([
    'other-record',
    'account',
    'chat-report',
    'chat-event',
    'escalate',
    'tag',
  ] as const)('rejects unsupported linkage: %s', async (kind) => {
    const f = await fixture()
    const selected = await report(
      kind === 'account'
        ? f.account
        : kind === 'chat-report'
          ? f.message
          : f.records[0],
    )
    const before = await detail(selected.id)
    const history = await activities(selected.id)
    const event =
      kind === 'escalate'
        ? tools.ozone.moderation.defs.modEventEscalate.$build({})
        : kind === 'tag'
          ? tools.ozone.moderation.defs.modEventTag.$build({
              add: ['review:example'],
              remove: [],
            })
          : tools.ozone.moderation.defs.modEventAcknowledge.$build({})
    await expect(
      mod.emitEvent({
        subject:
          kind === 'other-record' || kind === 'account'
            ? f.records[1]
            : kind === 'chat-event'
              ? f.message
              : f.account,
        event,
        reportAction: { ids: [selected.id] },
      }),
    ).rejects.toThrow(/No matching reports found/)
    expect(await detail(selected.id)).toEqual(before)
    expect(await activities(selected.id)).toEqual(history)
  })
})
