import { sql } from 'kysely'
import { ComAtprotoModerationDefs, ids } from '@atproto/api'
import type AtpAgent from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { chat, com, tools } from '../src/lexicons/index.js'
import {
  CHAT_CONVO_COLLECTION,
  CHAT_MESSAGE_COLLECTION,
} from '../src/mod-service/subject.js'
import { inboxHeaders, reportForEvent } from './_inbox.js'

const DEFS = 'tools.ozone.report.defs'

describe('report-close-reports', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const modHeaders = async (nsid: string) =>
    network.ozone.modHeaders(nsid, 'admin')

  const reportSubject = async (
    subject:
      | { $type: 'com.atproto.admin.defs#repoRef'; did: string }
      | { $type: 'com.atproto.repo.strongRef'; uri: string; cid: string },
    reasonType: string = ComAtprotoModerationDefs.REASONSPAM,
  ) => {
    await sc.createReport({
      reasonType,
      subject,
      reportedBy: sc.dids.bob,
    })
    await network.processAll()
  }

  const queryReports = async (params: {
    status: string
    subject?: string
    did?: string
  }) => {
    const { data } = await agent.tools.ozone.report.queryReports(params, {
      headers: await modHeaders(ids.ToolsOzoneReportQueryReports),
    })
    return data.reports
  }

  const closeReports = async (input: {
    subject: string
    includeAllOwned?: boolean
    reportTypes?: string[]
    excludedReportTypes?: string[]
    actionEventId?: number
    internalNote?: string
    isAutomated?: boolean
    meta?: Record<string, unknown>
  }) => {
    return agent.tools.ozone.report.closeReports(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportCloseReports,
        'admin',
      ),
    })
  }

  const listActivities = async (reportId: number) => {
    const { data } = await agent.tools.ozone.report.listActivities(
      { reportId },
      { headers: await modHeaders(ids.ToolsOzoneReportListActivities) },
    )
    return data.activities
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_close_reports',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  let fixtureNumber = 0

  async function fixture() {
    const name = `closereports${++fixtureNumber}`
    const { did } = await sc.createAccount(name, {
      handle: `${name}.test`,
      email: `${name}@example.com`,
      password: 'password',
    })
    const post = await sc.post(did, 'Example post')
    return {
      did,
      account: com.atproto.admin.defs.repoRef.$build({ did }),
      record: com.atproto.repo.strongRef.$build({
        uri: post.ref.uriStr,
        cid: post.ref.cidStr,
      }),
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

  type Subject = Awaited<ReturnType<typeof fixture>>[
    'account' | 'record' | 'message' | 'conversation']

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
    return reportForEvent(network.ozone.getModClient(), event.id, subjectKey)
  }

  async function reportsForSubjects(subjects: Subject[]) {
    const rows: Awaited<ReturnType<typeof report>>[] = []
    for (const subject of subjects) rows.push(await report(subject))
    return rows
  }

  async function detail(id: number) {
    return (
      await agent.tools.ozone.report.getReport(
        { id },
        { headers: await modHeaders(ids.ToolsOzoneReportGetReport) },
      )
    ).data
  }

  async function reopen(reportId: number) {
    await agent.tools.ozone.report.createActivity(
      {
        reportId,
        activity: tools.ozone.report.defs.reopenActivity.$build({}),
      },
      { headers: await modHeaders(ids.ToolsOzoneReportCreateActivity) },
    )
  }

  async function inbox(reportId: number) {
    return (
      await sc.agent.tools.ozone.inbox.getReport(
        { id: reportId },
        { headers: inboxHeaders(network, sc, sc.dids.bob) },
      )
    ).data
  }

  async function setStatus(
    reportId: number,
    status: 'queued' | 'assigned' | 'escalated',
  ) {
    if (status === 'assigned') {
      await agent.tools.ozone.report.assignModerator(
        {
          reportId,
          did: network.ozone.moderatorAccnt.did,
          isPermanent: true,
        },
        { headers: await modHeaders(ids.ToolsOzoneReportAssignModerator) },
      )
    } else {
      await agent.tools.ozone.report.createActivity(
        {
          reportId,
          activity:
            status === 'queued'
              ? tools.ozone.report.defs.queueActivity.$build({})
              : tools.ozone.report.defs.escalationActivity.$build({}),
        },
        { headers: await modHeaders(ids.ToolsOzoneReportCreateActivity) },
      )
    }
    expect((await detail(reportId)).status).toBe(status)
  }

  async function snapshotReports(reports: { id: number }[]) {
    const snapshots: {
      report: Awaited<ReturnType<typeof detail>>
      activities: Awaited<ReturnType<typeof listActivities>>
    }[] = []
    // @NOTE Avoid saturating the in-process AppView with concurrent fixture reads.
    for (const { id } of reports) {
      snapshots.push({
        report: await detail(id),
        activities: await listActivities(id),
      })
    }
    return snapshots
  }

  async function expectUnchanged(
    snapshots: Awaited<ReturnType<typeof snapshotReports>>,
  ) {
    for (const { report, activities } of snapshots) {
      const current = await detail(report.id)
      expect({
        status: current.status,
        updatedAt: current.updatedAt,
        actionEventIds: current.actionEventIds,
        actionNote: current.actionNote,
      }).toEqual({
        status: report.status,
        updatedAt: report.updatedAt,
        actionEventIds: report.actionEventIds,
        actionNote: report.actionNote,
      })
      expect(await listActivities(report.id)).toEqual(activities)
    }
  }

  describe.each(['account', 'record', 'message', 'conversation'] as const)(
    '%s active review',
    (kind) => {
      it.each([false, true])(
        'preserves active review during batch closure when isAutomated is %s',
        async (isAutomated) => {
          const f = await fixture()
          const open = await report(f[kind])
          const queued = await report(f[kind])
          await setStatus(queued.id, 'queued')
          const assigned = await report(f[kind])
          await setStatus(assigned.id, 'assigned')
          const permanent = await report(f[kind])
          await setStatus(permanent.id, 'assigned')
          await setStatus(permanent.id, 'queued')
          const escalated = await report(f[kind])
          await setStatus(escalated.id, 'escalated')
          const temporary = await report(f[kind])
          await agent.tools.ozone.report.assignModerator(
            { reportId: temporary.id },
            { headers: await modHeaders(ids.ToolsOzoneReportAssignModerator) },
          )
          const ended = await report(f[kind])
          await setStatus(ended.id, 'assigned')
          await agent.tools.ozone.report.unassignModerator(
            { reportId: ended.id },
            {
              headers: await modHeaders(ids.ToolsOzoneReportUnassignModerator),
            },
          )
          const excluded = await report(
            f[kind],
            com.atproto.moderation.defs.ReasonRude,
          )
          const before = await snapshotReports([
            assigned,
            permanent,
            escalated,
            excluded,
          ])
          const subject =
            kind === 'account'
              ? f.did
              : kind === 'record'
                ? f.record.uri
                : `at://${f.did}/${kind === 'message' ? CHAT_MESSAGE_COLLECTION : CHAT_CONVO_COLLECTION}/${kind === 'message' ? f.message.messageId : f.conversation.convoId}`
          const input = {
            subject,
            reportTypes: [
              com.atproto.moderation.defs.ReasonSpam,
              com.atproto.moderation.defs.ReasonRude,
            ],
            excludedReportTypes: [com.atproto.moderation.defs.ReasonRude],
            isAutomated,
          }
          expect((await closeReports(input)).data).toEqual({
            closedCount: 4,
            reportIds: [open.id, queued.id, temporary.id, ended.id],
          })
          for (const r of [open, queued, temporary, ended]) {
            expect((await detail(r.id)).status).toBe('closed')
            expect(await listActivities(r.id)).toContainEqual(
              expect.objectContaining({
                isAutomated,
                meta: { resolution: 'noAction' },
              }),
            )
          }
          expect((await closeReports(input)).data).toEqual({
            closedCount: 0,
            reportIds: [],
          })
          await expectUnchanged(before)

          for (const r of [assigned, permanent, escalated]) {
            await agent.tools.ozone.report.createActivity(
              {
                reportId: r.id,
                activity: tools.ozone.report.defs.closeActivity.$build({}),
              },
              { headers: await modHeaders(ids.ToolsOzoneReportCreateActivity) },
            )
            expect((await detail(r.id)).status).toBe('closed')
          }
        },
      )
    },
  )

  it.each(['all', 'types', 'exclusions'] as const)(
    'protects active review across owned subjects with %s targeting',
    async (selector) => {
      const f = await fixture()
      const selected: Awaited<ReturnType<typeof report>>[] = []
      const protectedReports: Awaited<ReturnType<typeof report>>[] = []
      for (const subject of [f.account, f.record, f.message, f.conversation]) {
        selected.push(await report(subject))
        const queued = await report(subject)
        await setStatus(queued.id, 'queued')
        selected.push(queued)
        for (const status of ['assigned', 'escalated'] as const) {
          const r = await report(subject)
          await setStatus(r.id, status)
          protectedReports.push(r)
        }
        const permanent = await report(subject)
        await setStatus(permanent.id, 'assigned')
        await setStatus(permanent.id, 'queued')
        protectedReports.push(permanent)
        const other = await report(
          subject,
          com.atproto.moderation.defs.ReasonRude,
        )
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

  it.each([undefined, false])(
    'keeps account closure exact when includeAllOwned is %s',
    async (includeAllOwned) => {
      const f = await fixture()
      const selected = await report(f.account)
      const untouched = await reportsForSubjects([
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
      const selected = await report(f.record)
      const untouched = await reportsForSubjects([
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
    const selected = await reportsForSubjects([
      f.account,
      f.record,
      f.message,
      f.conversation,
    ])
    const untouched = await reportsForSubjects([
      foreign.account,
      foreign.record,
      foreign.message,
      foreign.conversation,
    ])
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
      expect((await detail(r.id)).status).toBe('closed')
      expect((await detail(r.id)).actionEventIds ?? []).toEqual([])
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

  it('links an account action to eligible closures across all owned subjects', async () => {
    const f = await fixture()
    const foreign = await fixture()
    const selected = await reportsForSubjects([
      f.account,
      f.record,
      f.message,
      f.conversation,
    ])
    const assigned = await report(f.record)
    await setStatus(assigned.id, 'assigned')
    const other = await report(f.record, com.atproto.moderation.defs.ReasonRude)
    const untouched = await report(foreign.account)
    const action = await network.ozone.getModClient().emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
    })

    const result = await closeReports({
      subject: f.did,
      includeAllOwned: true,
      reportTypes: [com.atproto.moderation.defs.ReasonSpam],
      actionEventId: action.id,
      internalNote: 'Reviewed',
      meta: { source: 'test', actionEventId: 999, resolution: 'noAction' },
    })
    expect(result.data.reportIds.sort()).toEqual(
      selected.map((r) => r.id).sort(),
    )
    for (const r of selected) {
      expect((await detail(r.id)).actionEventIds).toEqual([action.id])
      expect(await listActivities(r.id)).toContainEqual(
        expect.objectContaining({
          internalNote: 'Reviewed',
          meta: {
            source: 'test',
            resolution: 'linked',
            actionEventId: action.id,
          },
        }),
      )
    }
    expect((await inbox(selected[0].id)).resolution?.outcome).toBe(
      'actionTaken',
    )
    expect((await inbox(selected[1].id)).resolution?.outcome).toBe(
      'actionTaken',
    )
    for (const r of [assigned, other, untouched]) {
      expect((await detail(r.id)).status).not.toBe('closed')
    }

    await reopen(selected[1].id)
    await closeReports({ subject: f.record.uri, actionEventId: action.id })
    expect((await detail(selected[1].id)).actionEventIds).toEqual([action.id])
  })

  it('rejects missing, unrelated, and non-closing action events without closing reports', async () => {
    const f = await fixture()
    const foreign = await fixture()
    const selected = await report(f.record)
    const before = await snapshotReports([selected])
    const mod = network.ozone.getModClient()
    const unrelated = await mod.emitEvent({
      subject: foreign.account,
      event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
    })
    const otherPost = await sc.post(f.did, 'Another record')
    await network.processAll()
    const wrongRecord = await mod.emitEvent({
      subject: com.atproto.repo.strongRef.$build({
        uri: otherPost.ref.uriStr,
        cid: otherPost.ref.cidStr,
      }),
      event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
    })
    const nonClosing = await mod.emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventEscalate.$build({}),
    })
    for (const actionEventId of [
      999999999,
      unrelated.id,
      wrongRecord.id,
      nonClosing.id,
    ]) {
      await expect(
        closeReports({ subject: f.record.uri, actionEventId }),
      ).rejects.toMatchObject({
        error: 'InvalidRequest',
      })
    }
    const recordEvent = await mod.emitEvent({
      subject: f.record,
      event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
    })
    await expect(
      closeReports({
        subject: f.did,
        includeAllOwned: true,
        actionEventId: recordEvent.id,
      }),
    ).rejects.toMatchObject({ error: 'InvalidRequest' })
    await expectUnchanged(before)
  })

  it.each(['message', 'conversation'] as const)(
    'links an event on the exact %s subject',
    async (kind) => {
      const f = await fixture()
      const foreign = await fixture()
      const selected = await report(f[kind])
      const untouched = await report(foreign[kind])
      const subject =
        kind === 'message'
          ? `at://${f.did}/${CHAT_MESSAGE_COLLECTION}/${f.message.messageId}`
          : `at://${f.did}/${CHAT_CONVO_COLLECTION}/${f.conversation.convoId}`
      const mod = network.ozone.getModClient()
      const wrongSubject =
        kind === 'message'
          ? chat.bsky.convo.defs.messageRef.$build({
              ...f.message,
              messageId: 'different-message',
            })
          : chat.bsky.convo.defs.convoRef.$build({
              ...f.conversation,
              convoId: 'different-conversation',
            })
      const wrongEvent = await mod.emitEvent({
        subject: wrongSubject,
        event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
      })
      const foreignEvent = await mod.emitEvent({
        subject: foreign[kind],
        event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
      })
      const action = await mod.emitEvent({
        subject: f[kind],
        event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
      })
      for (const actionEventId of [wrongEvent.id, foreignEvent.id]) {
        await expect(
          closeReports({ subject, actionEventId }),
        ).rejects.toMatchObject({
          error: 'InvalidRequest',
        })
      }
      await expect(
        closeReports({
          subject: f.did,
          includeAllOwned: true,
          actionEventId: action.id,
        }),
      ).rejects.toMatchObject({ error: 'InvalidRequest' })

      expect(
        (await closeReports({ subject, actionEventId: action.id })).data,
      ).toEqual({
        closedCount: 1,
        reportIds: [selected.id],
      })
      expect((await detail(selected.id)).actionEventIds).toEqual([action.id])
      expect(await listActivities(selected.id)).toContainEqual(
        expect.objectContaining({
          meta: { resolution: 'linked', actionEventId: action.id },
        }),
      )
      expect((await detail(untouched.id)).status).toBe('open')
    },
  )

  it('does not link a message event to the same message ID in another conversation', async () => {
    const f = await fixture()
    const selected = await report(f.message)
    const other = await report(
      chat.bsky.convo.defs.messageRef.$build({
        ...f.message,
        convoId: 'other-conversation',
      }),
    )
    const action = await network.ozone.getModClient().emitEvent({
      subject: f.message,
      event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
    })
    expect(
      (
        await closeReports({
          subject: `at://${f.did}/${CHAT_MESSAGE_COLLECTION}/${f.message.messageId}`,
          actionEventId: action.id,
        })
      ).data,
    ).toEqual({ closedCount: 1, reportIds: [selected.id] })
    expect((await detail(selected.id)).actionEventIds).toEqual([action.id])
    expect((await detail(other.id)).status).toBe('open')
    expect(await listActivities(other.id)).toHaveLength(0)
  })

  it('links an older action even when it was reversed before the report', async () => {
    const f = await fixture()
    const mod = network.ozone.getModClient()
    const action = await mod.emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
    })
    await mod.emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: [],
        negateLabelVals: ['spam'],
      }),
    })
    const selected = await report(f.account)
    expect(action.id).toBeLessThan(selected.eventId)
    expect(
      (await closeReports({ subject: f.did, actionEventId: action.id })).data,
    ).toEqual({
      closedCount: 1,
      reportIds: [selected.id],
    })
    expect((await detail(selected.id)).actionEventIds).toEqual([action.id])
    expect((await inbox(selected.id)).resolution?.outcome).toBe('actionTaken')
  })

  it('links one emitted account event to all owned reports and preserves active review', async () => {
    const f = await fixture()
    const foreign = await fixture()
    const selected = await reportsForSubjects([
      f.account,
      f.record,
      f.message,
      f.conversation,
    ])
    const explicit = await report(f.record)
    await setStatus(explicit.id, 'assigned')
    const assigned = await report(f.record)
    await setStatus(assigned.id, 'assigned')
    const escalated = await report(f.account)
    await setStatus(escalated.id, 'escalated')
    const untouched = await report(foreign.account)
    const action = await network.ozone.getModClient().emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
      reportAction: { allOwned: true, ids: [explicit.id] },
    })
    for (const r of [...selected, explicit]) {
      expect((await detail(r.id)).status).toBe('closed')
      expect((await detail(r.id)).actionEventIds).toEqual([action.id])
      expect(await listActivities(r.id)).toContainEqual(
        expect.objectContaining({
          meta: { resolution: 'linked', actionEventId: action.id },
        }),
      )
    }
    for (const r of [assigned, escalated, untouched]) {
      expect((await detail(r.id)).status).not.toBe('closed')
    }
  })

  it('rejects allOwned on records and events that do not close reports', async () => {
    const f = await fixture()
    const selected = await report(f.record)
    const before = await snapshotReports([selected])
    const mod = network.ozone.getModClient()
    await expect(
      mod.emitEvent({
        subject: f.record,
        event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
        reportAction: { allOwned: true },
      }),
    ).rejects.toThrow('allOwned requires an account subject')
    await expect(
      mod.emitEvent({
        subject: f.account,
        event: tools.ozone.moderation.defs.modEventEscalate.$build({}),
        reportAction: { allOwned: true },
      }),
    ).rejects.toThrow('allOwned requires an event that closes reports')
    await expectUnchanged(before)
  })

  it('accepts allOwned as the only target and links record actions on exact subjects', async () => {
    const f = await fixture()
    const recordReport = await report(f.record)
    const recordAction = await network.ozone.getModClient().emitEvent({
      subject: f.record,
      event: tools.ozone.moderation.defs.modEventAcknowledge.$build({}),
    })
    await closeReports({
      subject: f.record.uri,
      actionEventId: recordAction.id,
    })
    expect((await detail(recordReport.id)).actionEventIds).toEqual([
      recordAction.id,
    ])

    await reopen(recordReport.id)
    const accountAction = await network.ozone.getModClient().emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
      reportAction: { allOwned: true },
    })
    expect((await detail(recordReport.id)).status).toBe('closed')
    expect((await detail(recordReport.id)).actionEventIds).toEqual([
      recordAction.id,
      accountAction.id,
    ])
  })

  it.each(['record', 'message', 'conversation'] as const)(
    'rejects includeAllOwned for a %s AT-URI without closing any reports',
    async (kind) => {
      const f = await fixture()
      const selected = await report(f[kind])
      const untouched = await reportsForSubjects(
        [f.account, f.record, f.message, f.conversation].filter(
          (subject) => subject !== f[kind],
        ),
      )
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

  it('retains optional reason filtering across all owned subjects', async () => {
    const f = await fixture()
    const selected = await reportsForSubjects([
      f.account,
      f.record,
      f.message,
      f.conversation,
    ])
    const other = await report(f.record, com.atproto.moderation.defs.ReasonRude)
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
      const selected = await report(f[kind])
      const excluded = await report(
        f[kind],
        com.atproto.moderation.defs.ReasonRude,
      )
      const untouched = await reportsForSubjects([
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
    const selected = await reportsForSubjects(subjects)
    const excluded: Awaited<ReturnType<typeof report>>[] = []
    for (const subject of subjects) {
      excluded.push(
        await report(subject, com.atproto.moderation.defs.ReasonRude),
        await report(subject, com.atproto.moderation.defs.ReasonMisleading),
      )
    }
    await agent.tools.ozone.report.createActivity(
      {
        reportId: excluded[0].id,
        activity: tools.ozone.report.defs.escalationActivity.$build({}),
        internalNote: 'Needs further review',
      },
      { headers: await modHeaders(ids.ToolsOzoneReportCreateActivity) },
    )
    const untouched = await reportsForSubjects([
      foreign.account,
      foreign.record,
      foreign.message,
      foreign.conversation,
    ])
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
      const selected = await report(f.account)
      const other = await report(
        f.account,
        com.atproto.moderation.defs.ReasonRude,
      )
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
      const selected = await report(f.account)
      const excluded = await report(
        f.account,
        com.atproto.moderation.defs.ReasonRude,
      )
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
      const selected = await report(f.account)
      const excluded = await report(
        f.account,
        com.atproto.moderation.defs.ReasonRude,
      )
      const outside = await report(
        f.account,
        com.atproto.moderation.defs.ReasonMisleading,
      )
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
    const excluded = await report(f.account, excludedType)
    const selected = await report(f.account, `${excludedType}Other`)
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

  it('associates selected reasons with enforcement and excludes reasons from cleanup', async () => {
    const f = await fixture()
    const actioned = await report(f.account)
    const excluded = await report(
      f.account,
      com.atproto.moderation.defs.ReasonMisleading,
    )
    const remaining = [
      await report(f.account, com.atproto.moderation.defs.ReasonRude),
      await report(f.record, com.atproto.moderation.defs.ReasonRude),
    ]
    const action = await network.ozone.getModClient().emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventTakedown.$build({
        durationInHours: 24,
      }),
      reportAction: { types: [com.atproto.moderation.defs.ReasonSpam] },
    })
    expect(
      (
        await closeReports({
          subject: f.did,
          includeAllOwned: true,
          excludedReportTypes: [
            com.atproto.moderation.defs.ReasonSpam,
            com.atproto.moderation.defs.ReasonMisleading,
          ],
        })
      ).data.reportIds.sort(),
    ).toEqual(remaining.map((r) => r.id).sort())
    expect((await detail(actioned.id)).actionEventIds).toEqual([action.id])
    expect((await inbox(actioned.id)).resolution?.outcome).toBe('actionTaken')
    expect((await detail(excluded.id)).status).toBe('open')
    expect(await listActivities(excluded.id)).toHaveLength(0)
    for (const r of remaining) {
      expect((await detail(r.id)).actionEventIds ?? []).toEqual([])
      expect((await inbox(r.id)).resolution?.outcome).toBe('noAction')
    }
  })

  it('preserves old action links while counting the current closure as no-action', async () => {
    const f = await fixture()
    const reason = tools.ozone.report.defs.ReasonMisleadingBot
    const r = await report(f.record, reason)
    const mod = network.ozone.getModClient()
    const queue = (
      await agent.tools.ozone.queue.createQueue(
        { name: 'Closure history', subjectTypes: [], reportTypes: [reason] },
        { headers: await modHeaders(ids.ToolsOzoneQueueCreateQueue) },
      )
    ).data.queue
    await agent.tools.ozone.report.reassignQueue(
      { reportId: r.id, queueId: queue.id },
      { headers: await modHeaders(ids.ToolsOzoneReportReassignQueue) },
    )
    const label = await mod.emitEvent({
      subject: f.record,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
      reportAction: { ids: [r.id] },
    })
    await reopen(r.id)
    await closeReports({ subject: f.did, includeAllOwned: true })
    expect((await detail(r.id)).actionEventIds).toEqual([label.id])
    expect((await inbox(r.id)).resolution?.outcome).toBe('noAction')
    const stats = async () => {
      await mod.computeStats()
      return (
        await agent.tools.ozone.report.getLiveStats(
          { queueId: queue.id },
          { headers: await modHeaders(ids.ToolsOzoneReportGetLiveStats) },
        )
      ).data.stats
    }
    expect(await stats()).toMatchObject({
      closedCount: 1,
      actionedCount: 0,
      acknowledgedCount: 1,
      labelActionCount: 0,
    })
    await reopen(r.id)
    await mod.emitEvent({
      subject: f.record,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
      reportAction: { ids: [r.id] },
    })
    expect(await stats()).toMatchObject({
      closedCount: 1,
      actionedCount: 1,
      acknowledgedCount: 0,
      labelActionCount: 1,
    })
  })

  it('does not duplicate activities during concurrent cleanup', async () => {
    const f = await fixture()
    const reports = await reportsForSubjects([f.account, f.record])
    const input = { subject: f.did, includeAllOwned: true }
    const results = await Promise.all([
      closeReports(input),
      closeReports(input),
    ])
    expect(
      results.reduce((count, result) => count + result.data.closedCount, 0),
    ).toBe(reports.length)
    for (const r of reports) expect(await listActivities(r.id)).toHaveLength(1)
  })

  it('closes all open reports on an account subject', async () => {
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      ComAtprotoModerationDefs.REASONSPAM,
    )
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      ComAtprotoModerationDefs.REASONRUDE,
    )

    const openBefore = await queryReports({
      status: 'open',
      subject: sc.dids.alice,
    })
    expect(openBefore.length).toBeGreaterThanOrEqual(2)

    const { data } = await closeReports({
      subject: sc.dids.alice,
      internalNote: 'Auto-closed by rules engine.',
      isAutomated: true,
    })

    expect(data.closedCount).toBe(openBefore.length)
    expect(data.reportIds.sort()).toEqual(openBefore.map((r) => r.id).sort())

    const openAfter = await queryReports({
      status: 'open',
      subject: sc.dids.alice,
    })
    expect(openAfter).toHaveLength(0)

    // Each closed report gets a closeActivity with the note + isAutomated
    for (const reportId of data.reportIds) {
      const activities = await listActivities(reportId)
      const close = activities.find(
        (a) => a.activity.$type === `${DEFS}#closeActivity`,
      )
      expect(close).toBeDefined()
      expect(close!.internalNote).toBe('Auto-closed by rules engine.')
      expect(close!.isAutomated).toBe(true)
    }
  })

  it('filters by report types', async () => {
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.carol },
      ComAtprotoModerationDefs.REASONSPAM,
    )
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.carol },
      ComAtprotoModerationDefs.REASONMISLEADING,
    )

    const { data } = await closeReports({
      subject: sc.dids.carol,
      reportTypes: [ComAtprotoModerationDefs.REASONSPAM],
    })
    expect(data.closedCount).toBe(1)

    const stillOpen = await queryReports({
      status: 'open',
      subject: sc.dids.carol,
    })
    expect(stillOpen).toHaveLength(1)
    expect(stillOpen[0].reportType).toBe(
      ComAtprotoModerationDefs.REASONMISLEADING,
    )
  })

  it('scopes to record-level reports when subject is an AT-URI', async () => {
    const post = sc.posts[sc.dids.alice][0].ref
    await reportSubject(
      {
        $type: 'com.atproto.repo.strongRef',
        uri: post.uriStr,
        cid: post.cidStr,
      },
      ComAtprotoModerationDefs.REASONSPAM,
    )
    // account-level report on the same DID should not be touched
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      ComAtprotoModerationDefs.REASONSPAM,
    )

    const { data } = await closeReports({ subject: post.uriStr })
    expect(data.closedCount).toBe(1)

    const accountReports = await queryReports({
      status: 'open',
      subject: sc.dids.alice,
    })
    expect(accountReports).toHaveLength(1)
  })

  it('scopes message, conversation, and account reports independently', async () => {
    const convoId = 'close-reports-convo'
    const messageId = 'close-reports-message'
    const convoUri = `at://${sc.dids.dan}/chat.bsky.convo/${convoId}`
    const messageUri = `at://${sc.dids.dan}/chat.bsky.convo.message/${messageId}`

    await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: {
        $type: 'chat.bsky.convo.defs#messageRef',
        did: sc.dids.dan,
        convoId,
        messageId,
      },
      reportedBy: sc.dids.bob,
    })
    await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: {
        $type: 'chat.bsky.convo.defs#convoRef',
        did: sc.dids.dan,
        convoId,
      },
      reportedBy: sc.dids.bob,
    })
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.dan },
      ComAtprotoModerationDefs.REASONSPAM,
    )
    await network.processAll()

    const accountResult = await closeReports({ subject: sc.dids.dan })
    expect(accountResult.data.closedCount).toBe(1)

    const messageResult = await closeReports({ subject: messageUri })
    expect(messageResult.data.closedCount).toBe(1)

    const convoResult = await closeReports({ subject: convoUri })
    expect(convoResult.data.closedCount).toBe(1)
  })

  it('returns zero when no reports match', async () => {
    const { data } = await closeReports({
      subject: 'did:plc:doesnotexistanywhere',
    })
    expect(data.closedCount).toBe(0)
    expect(data.reportIds).toEqual([])
  })

  it('rejects a subject that is neither a DID nor an AT-URI', async () => {
    await expect(
      closeReports({ subject: 'https://example.com' }),
    ).rejects.toMatchObject({ error: 'InvalidRequest' })
  })

  it('closes queued reports too', async () => {
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.dan },
      ComAtprotoModerationDefs.REASONSPAM,
    )
    const [report] = await queryReports({
      status: 'open',
      subject: sc.dids.dan,
    })
    await agent.tools.ozone.report.createActivity(
      {
        reportId: report.id,
        activity: { $type: `${DEFS}#queueActivity` },
      },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneReportCreateActivity,
          'admin',
        ),
      },
    )

    const { data } = await closeReports({ subject: sc.dids.dan })
    expect(data.closedCount).toBe(1)
    expect(data.reportIds).toEqual([report.id])
  })
  it('links account actions across multiple report update batches', async () => {
    const f = await fixture()
    const template = await report(f.record)
    const db = network.ozone.ctx.db
    // @NOTE Bulk fixtures exercise the event-linked update batches directly.
    await sql`
      with events as (
        insert into moderation_event (action, "subjectType", "subjectDid", "subjectUri", "subjectCid", "createdAt", "createdBy", meta)
        select action, "subjectType", "subjectDid", "subjectUri", "subjectCid", "createdAt", "createdBy", meta
        from moderation_event cross join generate_series(1, 505)
        where id = ${template.eventId}
        returning id
      )
      insert into report ("eventId", did, "reporterDid", "recordPath", "reportType", status, "createdAt", "updatedAt", "queueId", "isMuted", "isAutomated")
      select events.id, r.did, r."reporterDid", r."recordPath", r."reportType", r.status, r."createdAt", r."updatedAt", -1, false, false
      from events cross join report r where r.id = ${template.id}
    `.execute(db.db)
    // Drain the router's 100-event batches so synthetic events cannot delay
    // routing reports created by subsequent tests.
    for (let i = 0; i < 6; i++) {
      await network.ozone.daemon.ctx.queueRouter.routeReports()
    }
    const action = await network.ozone.getModClient().emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
      reportAction: { allOwned: true },
    })
    const counts = await sql<{ reports: number; activities: number }>`
      select count(*)::int as reports,
        count(*) filter (where a.meta ->> 'actionEventId' = ${String(action.id)})::int as activities
      from report r join report_activity a on a."reportId" = r.id
      where r.did = ${f.did} and r.status = 'closed'
        and r."actionEventIds" @> ${JSON.stringify([action.id])}::jsonb
    `.execute(db.db)
    expect(counts.rows[0]).toEqual({ reports: 506, activities: 506 })
  })

  it('closes thousands of reports atomically within SQL parameter limits', async () => {
    const f = await fixture()
    const template = await report(f.record)
    const db = network.ozone.ctx.db
    const meta = {
      source: 'example-worker',
      rules: [{ name: 'example/cleanup', version: 1 }],
      custom: { batch: 'example-batch' },
    }
    // @NOTE Bulk database fixtures exercise the protocol parameter limit directly.
    await sql`
      with events as (
        insert into moderation_event (action, "subjectType", "subjectDid", "subjectUri", "subjectCid", "createdAt", "createdBy", meta)
        select action, "subjectType", "subjectDid", "subjectUri", "subjectCid", "createdAt", "createdBy", meta
        from moderation_event cross join generate_series(1, 7000)
        where id = ${template.eventId}
        returning id
      )
      insert into report ("eventId", did, "reporterDid", "recordPath", "reportType", status, "createdAt", "updatedAt", "queueId", "isMuted", "isAutomated")
      select events.id, r.did, r."reporterDid", r."recordPath", r."reportType", r.status, r."createdAt", r."updatedAt", -1, false, false
      from events cross join report r where r.id = ${template.id}
    `.execute(db.db)
    const lastReport = await db.db
      .selectFrom('report')
      .select('id')
      .where('did', '=', f.did)
      .orderBy('id', 'desc')
      .limit(1)
      .executeTakeFirstOrThrow()
    await sql`create function fail_close_batch() returns trigger language plpgsql as $$ begin raise exception 'Injected close batch failure'; end $$`.execute(
      db.db,
    )
    await sql`create trigger fail_close_batch before insert on report_activity for each row when (new."reportId" = ${sql.lit(lastReport.id)}) execute function fail_close_batch()`.execute(
      db.db,
    )
    try {
      await expect(
        closeReports({ subject: f.did, includeAllOwned: true, meta }),
      ).rejects.toThrow()
      const closed = await db.db
        .selectFrom('report')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('did', '=', f.did)
        .where('status', '=', 'closed')
        .executeTakeFirstOrThrow()
      expect(closed.count).toBe(0)
      expect(await listActivities(template.id)).toHaveLength(0)
    } finally {
      await sql`drop trigger fail_close_batch on report_activity`.execute(db.db)
      await sql`drop function fail_close_batch()`.execute(db.db)
    }
    const { data } = await closeReports({
      subject: f.did,
      includeAllOwned: true,
      meta,
    })
    expect(data.closedCount).toBe(7001)
    expect(new Set(data.reportIds).size).toBe(7001)
    const counts = await db.db
      .selectFrom('report_activity')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('reportId', 'in', data.reportIds)
      .executeTakeFirstOrThrow()
    expect(counts.count).toBe(7001)
    expect((await listActivities(template.id))[0].meta).toEqual({
      ...meta,
      resolution: 'noAction',
    })
    expect(
      (await closeReports({ subject: f.did, includeAllOwned: true })).data
        .closedCount,
    ).toBe(0)
  })
})
