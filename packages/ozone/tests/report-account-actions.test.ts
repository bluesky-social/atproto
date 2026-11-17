import { ids } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { chat, com, tools } from '../src/lexicons/index.js'
import {
  CHAT_CONVO_COLLECTION,
  CHAT_MESSAGE_COLLECTION,
} from '../src/mod-service/subject.js'
import { reportForEvent } from './_inbox.js'

describe('report linkage between accounts and content', () => {
  let network: TestNetwork
  let sc: SeedClient
  let mod: ModeratorClient
  let fixtureNumber = 0

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_account_actions',
    })
    sc = network.getSeedClient()
    mod = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => network?.close())

  async function fixture() {
    const name = `accountaction${++fixtureNumber}`
    const { did } = await sc.createAccount(name, {
      handle: `${name}.test`,
      email: `${name}@example.com`,
      password: 'password',
    })
    const records: ReturnType<typeof com.atproto.repo.strongRef.$build>[] = []
    for (let i = 0; i < 2; i++) {
      const post = await sc.post(did, `Example post ${i}`)
      records.push(
        com.atproto.repo.strongRef.$build({
          uri: post.ref.uriStr,
          cid: post.ref.cidStr,
        }),
      )
    }
    await network.processAll()
    return {
      did,
      account: com.atproto.admin.defs.repoRef.$build({ did }),
      records,
      message: chat.bsky.convo.defs.messageRef.$build({
        did,
        convoId: 'example-conversation',
        messageId: 'example-message',
      }),
      conversation: chat.bsky.convo.defs.convoRef.$build({
        did,
        convoId: 'example-conversation',
      }),
    }
  }

  type Fixture = Awaited<ReturnType<typeof fixture>>
  type Subject =
    Fixture['account' | 'message' | 'conversation'] | Fixture['records'][number]
  type ReportSubjectTypes = NonNullable<
    tools.ozone.moderation.emitEvent.ReportAction['subjectTypes']
  >

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
    const subjectKey =
      'uri' in subject
        ? subject.uri
        : 'messageId' in subject
          ? `at://${subject.did}/${CHAT_MESSAGE_COLLECTION}/${subject.messageId}`
          : 'convoId' in subject
            ? `at://${subject.did}/${CHAT_CONVO_COLLECTION}/${subject.convoId}`
            : subject.did
    return reportForEvent(mod, event.id, subjectKey)
  }

  async function detail(id: number) {
    const { data } = await mod.agent.tools.ozone.report.getReport(
      { id },
      {
        headers: await network.ozone.modHeaders(ids.ToolsOzoneReportGetReport),
      },
    )
    return {
      status: data.status,
      actionEventIds: data.actionEventIds ?? null,
      updatedAt: data.updatedAt,
      actionNote: data.actionNote,
    }
  }

  async function activities(reportId: number) {
    const { data } = await mod.agent.tools.ozone.report.listActivities(
      { reportId },
      {
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneReportListActivities,
        ),
      },
    )
    return data.activities
  }

  const takedown = () => tools.ozone.moderation.defs.modEventTakedown.$build({})
  const label = () =>
    tools.ozone.moderation.defs.modEventLabel.$build({
      createLabelVals: ['spam'],
      negateLabelVals: [],
    })

  async function snapshots(reports: { id: number }[]) {
    const result: Awaited<ReturnType<typeof detail>>[] = []
    for (const { id } of reports) result.push(await detail(id))
    return result
  }

  describe.each(['account', 'record', 'message', 'conversation'] as const)(
    'default %s targeting',
    (kind) => {
      it.each([
        { subjects: undefined },
        { subjects: [] },
        { subjectTypes: [] },
      ])(
        'keeps the current subject when additional subjects are %j',
        async (targeting) => {
          const f = await fixture()
          const subject = kind === 'record' ? f.records[0] : f[kind]
          const current = await report(subject)
          const untouched = [await report(f.records[1])]
          if (kind !== 'account') untouched.push(await report(f.account))
          if (kind !== 'record') untouched.push(await report(f.records[0]))
          if (kind !== 'message') untouched.push(await report(f.message))
          if (kind !== 'conversation')
            untouched.push(await report(f.conversation))
          if (kind === 'message') {
            untouched.push(
              await report(
                chat.bsky.convo.defs.messageRef.$build({
                  ...f.message,
                  convoId: 'other-conversation',
                }),
              ),
            )
          }
          const before = await snapshots(untouched)
          await mod.emitEvent({
            subject,
            event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
            reportAction: { all: true, ...targeting },
          })
          expect((await detail(current.id)).status).toBe('closed')
          expect(await snapshots(untouched)).toEqual(before)
        },
      )
    },
  )

  it.each(['label', 'takedown'] as const)(
    'closes matching types on the account and one exact record with an account %s',
    async (kind) => {
      const f = await fixture()
      const other = await fixture()
      const selected = [
        await report(f.account),
        await report(f.records[0]),
        await report(f.records[0]),
      ]
      const explicit = await report(
        f.records[0],
        com.atproto.moderation.defs.ReasonRude,
      )
      selected.push(explicit)
      const untouched = [
        await report(f.account, com.atproto.moderation.defs.ReasonRude),
        await report(f.records[0], com.atproto.moderation.defs.ReasonRude),
        await report(f.records[1]),
        await report(f.message),
        await report(f.conversation),
        await report(other.account),
        await report(other.records[0]),
      ]
      const before = await snapshots(untouched)
      const event = await mod.emitEvent({
        subject: f.account,
        event: kind === 'label' ? label() : takedown(),
        reportAction: {
          subjects: [f.records[0]],
          types: [com.atproto.moderation.defs.ReasonSpam],
          ids: [explicit.id],
          note: 'Reviewed account and content reports',
        },
      })
      for (const r of selected) {
        expect(await detail(r.id)).toMatchObject({
          status: 'closed',
          actionEventIds: [event.id],
          actionNote: 'Reviewed account and content reports',
        })
        expect(await activities(r.id)).toContainEqual(
          expect.objectContaining({
            activity: expect.objectContaining({
              $type: tools.ozone.report.defs.closeActivity.$type,
            }),
            meta: expect.objectContaining({
              resolution: 'linked',
              actionEventId: event.id,
            }),
          }),
        )
      }
      expect(await snapshots(untouched)).toEqual(before)
    },
  )

  it.each(['message', 'conversation'] as const)(
    'closes the account and exact %s reports without widening or duplicate activities',
    async (kind) => {
      const f = await fixture()
      const other = await fixture()
      const selected = [await report(f.account), await report(f[kind])]
      const untouched = [
        await report(f.records[0]),
        await report(kind === 'message' ? f.conversation : f.message),
        await report(
          chat.bsky.convo.defs.messageRef.$build({
            ...f.message,
            convoId: 'other-conversation',
          }),
        ),
        await report(
          chat.bsky.convo.defs.convoRef.$build({
            ...f.conversation,
            convoId: 'other-conversation',
          }),
        ),
        await report(other[kind]),
        await report(other.account),
      ]
      const before = await snapshots(untouched)
      const event = await mod.emitEvent({
        subject: f.account,
        event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
        reportAction: { subjects: [f[kind], f[kind], f.account], all: true },
      })
      for (const r of selected) {
        expect(await detail(r.id)).toMatchObject({
          status: 'closed',
          actionEventIds: [event.id],
        })
        const closed = (await activities(r.id)).filter(
          ({ activity }) =>
            activity.$type === tools.ozone.report.defs.closeActivity.$type,
        )
        expect(closed).toHaveLength(1)
      }
      expect(await snapshots(untouched)).toEqual(before)
    },
  )

  it('combines exact records and messages while always retaining the account subject', async () => {
    const f = await fixture()
    const selected = [
      await report(f.account),
      await report(f.records[0]),
      await report(f.message),
    ]
    const untouched = [await report(f.records[1]), await report(f.conversation)]
    const before = await snapshots(untouched)
    const event = await mod.emitEvent({
      subject: f.account,
      event: label(),
      reportAction: { subjects: [f.records[0], f.message], all: true },
    })
    for (const r of selected) {
      expect(await detail(r.id)).toMatchObject({
        status: 'closed',
        actionEventIds: [event.id],
      })
    }
    expect(await snapshots(untouched)).toEqual(before)
  })

  it.each<{ subjectTypes: ReportSubjectTypes }>([
    { subjectTypes: ['account'] },
    { subjectTypes: ['record'] },
    { subjectTypes: ['message'] },
    { subjectTypes: ['conversation'] },
    { subjectTypes: ['record', 'message'] },
  ])(
    'closes matching report types on the account and owned $subjectTypes subjects',
    async ({ subjectTypes }) => {
      const f = await fixture()
      const other = await fixture()
      const candidates: [ReportSubjectTypes[number], Subject][] = [
        ['account', f.account],
        ['record', f.records[0]],
        ['record', f.records[1]],
        ['message', f.message],
        ['conversation', f.conversation],
      ]
      const selected: Awaited<ReturnType<typeof report>>[] = []
      const untouched: Awaited<ReturnType<typeof report>>[] = []
      for (const [kind, subject] of candidates) {
        const matching = kind === 'account' || subjectTypes.includes(kind)
        const reports = matching ? selected : untouched
        reports.push(await report(subject))
      }
      const selectedSubject = candidates.find(([kind]) =>
        subjectTypes.includes(kind),
      )![1]
      for (const subject of [f.account, selectedSubject]) {
        untouched.push(
          await report(subject, com.atproto.moderation.defs.ReasonRude),
        )
      }
      for (const subject of [
        other.account,
        other.records[0],
        other.message,
        other.conversation,
      ]) {
        untouched.push(await report(subject))
      }
      const before = await snapshots(untouched)
      const event = await mod.emitEvent({
        subject: f.account,
        event: takedown(),
        reportAction: {
          subjectTypes,
          types: [com.atproto.moderation.defs.ReasonSpam],
        },
      })
      for (const r of selected) {
        expect(await detail(r.id)).toMatchObject({
          status: 'closed',
          actionEventIds: [event.id],
        })
      }
      expect(await snapshots(untouched)).toEqual(before)
    },
  )

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
      const reports = [await report(f.account), await report(f.records[0])]
      const before = await snapshots(reports)
      await expect(
        mod.emitEvent({
          subject: f.account,
          event: label(),
          reportAction: { subjects: [f.records[0], subject], all: true },
        }),
      ).rejects.toThrow('report subjects must belong to the actioned account')
      expect(await snapshots(reports)).toEqual(before)
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

  it.each([
    { selector: 'types', targeting: 'subjects' },
    { selector: 'all', targeting: 'subjects' },
    { selector: 'types', targeting: 'subjectTypes' },
    { selector: 'all', targeting: 'subjectTypes' },
  ])(
    'protects active reviews for $selector with $targeting and permits explicit account IDs',
    async ({ selector, targeting }) => {
      const f = await fixture()
      const protectedReports: Awaited<ReturnType<typeof report>>[] = []
      const selected: Awaited<ReturnType<typeof report>>[] = []
      for (const subject of [f.account, f.records[0]]) {
        selected.push(await report(subject))
        const assigned = await report(subject)
        await mod.agent.tools.ozone.report.assignModerator(
          {
            reportId: assigned.id,
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
        protectedReports.push(assigned)
        const escalated = await report(subject)
        await mod.agent.tools.ozone.report.createActivity(
          {
            reportId: escalated.id,
            activity: tools.ozone.report.defs.escalationActivity.$build({}),
          },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneReportCreateActivity,
            ),
          },
        )
        protectedReports.push(escalated)
        const active = await report(subject)
        await mod.agent.tools.ozone.report.assignModerator(
          { reportId: active.id, isPermanent: true },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneReportAssignModerator,
            ),
          },
        )
        await mod.agent.tools.ozone.report.createActivity(
          {
            reportId: active.id,
            activity: tools.ozone.report.defs.queueActivity.$build({}),
          },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneReportCreateActivity,
            ),
          },
        )
        protectedReports.push(active)
      }
      const explicit = protectedReports.shift()!
      const before = await Promise.all(
        protectedReports.map((r) => detail(r.id)),
      )
      const expansion: tools.ozone.moderation.emitEvent.ReportAction =
        targeting === 'subjectTypes'
          ? { subjectTypes: ['record'] }
          : { subjects: [f.records[0]] }
      const event = await mod.emitEvent({
        subject: f.account,
        event: label(),
        reportAction: {
          ...expansion,
          ids: [explicit.id],
          ...(selector === 'all'
            ? { all: true }
            : { types: [com.atproto.moderation.defs.ReasonSpam] }),
        },
      })
      for (const r of [...selected, explicit]) {
        expect(await detail(r.id)).toMatchObject({
          status: 'closed',
          actionEventIds: [event.id],
        })
      }
      expect(
        await Promise.all(protectedReports.map((r) => detail(r.id))),
      ).toEqual(before)
    },
  )

  it.each(['outside-scope', 'foreign', 'missing', 'closed'] as const)(
    'rolls back account enforcement and report updates for a %s ID',
    async (invalid) => {
      const f = await fixture()
      const selected = [await report(f.account), await report(f.records[0])]
      const other = await report(
        invalid === 'foreign'
          ? (await fixture()).account
          : invalid === 'outside-scope'
            ? f.message
            : f.records[1],
      )
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
    const account = await report(f.account)
    const current = await report(f.message)
    const other = await report(
      chat.bsky.convo.defs.messageRef.$build({
        ...f.message,
        convoId: 'other-conversation',
      }),
    )
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

  it.each(['owned', 'foreign', 'subjectTypes'] as const)(
    'lets allOwned override %s targeting',
    async (kind) => {
      const f = await fixture()
      const other = await fixture()
      const selected: Awaited<ReturnType<typeof report>>[] = []
      for (const subject of [
        f.account,
        ...f.records,
        f.message,
        f.conversation,
      ]) {
        selected.push(await report(subject))
      }
      const untouched: Awaited<ReturnType<typeof report>>[] = []
      for (const subject of [
        other.account,
        ...other.records,
        other.message,
        other.conversation,
      ]) {
        untouched.push(await report(subject))
      }
      const before = await snapshots(untouched)
      const targets = kind === 'owned' ? f : other
      const event = await mod.emitEvent({
        subject: f.account,
        event: label(),
        reportAction: {
          allOwned: true,
          ...(kind === 'subjectTypes'
            ? { subjectTypes: ['message'] as ReportSubjectTypes }
            : {
                subjects: [
                  targets.account,
                  targets.records[0],
                  targets.message,
                  targets.conversation,
                ],
              }),
        },
      })
      for (const r of selected) {
        expect(await detail(r.id)).toMatchObject({
          status: 'closed',
          actionEventIds: [event.id],
        })
      }
      expect(await snapshots(untouched)).toEqual(before)
    },
  )

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
    const selected = await report(f.account)
    const untouched = await report(f.records[0])
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
      const selected = await report(f.records[0])
      const untouched = [
        await report(f.records[0]),
        await report(f.records[1]),
        await report(f.account),
        await report(other.records[0]),
      ]
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
      const selected = await report(
        f.records[0],
        com.atproto.moderation.defs.ReasonMisleading,
      )
      const account = await report(f.account)
      const untouched = [await report(f.records[0]), await report(f.records[1])]
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
      const selected = await report(f.records[0])
      const account = await report(f.account)
      const other = await report(
        invalid === 'foreign' ? (await fixture()).records[0] : f.records[1],
      )
      if (invalid === 'closed') {
        await mod.emitEvent({
          subject: f.records[1],
          event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
          reportAction: { ids: [other.id] },
        })
      }
      const reports = [selected, account, other]
      const before = await Promise.all(reports.map((r) => detail(r.id)))
      const history = await Promise.all(reports.map((r) => activities(r.id)))
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
      expect(await Promise.all(reports.map((r) => detail(r.id)))).toEqual(
        before,
      )
      expect(await Promise.all(reports.map((r) => activities(r.id)))).toEqual(
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
