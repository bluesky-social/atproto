import { ids } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { chat, com, tools } from '../src/lexicons/index.js'
import { CHAT_MESSAGE_COLLECTION } from '../src/mod-service/subject.js'
import { reportForEvent } from './_inbox.js'

describe('account actions on content reports', () => {
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
    }
  }

  type Fixture = Awaited<ReturnType<typeof fixture>>
  type Subject = Fixture['account' | 'message'] | Fixture['records'][number]

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
