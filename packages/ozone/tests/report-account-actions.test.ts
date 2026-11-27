import { beforeAll, describe, expect, it } from 'vitest'
import { ids } from '@atproto/api'
import type { ModeratorClient, TestNetwork } from '@atproto/dev-env'
import { chat, com, tools } from '../src/lexicons/index.js'
import {
  type ReportSubjectTypes,
  label,
  setupAccountActions,
  takedown,
} from './_account-actions.js'
import type { ReportRow, ReportSubject } from './_inbox.js'

describe('report linkage between accounts and content', () => {
  const t = setupAccountActions('ozone_report_account_actions')
  const { fixture, reports, detail, activities, snapshots } = t
  let mod: ModeratorClient
  let network: TestNetwork

  beforeAll(() => {
    mod = t.mod
    network = t.network
  })

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
          const [current, ...untouched] = await reports([
            subject,
            f.records[1],
            ...(kind !== 'account' ? [f.account] : []),
            ...(kind !== 'record' ? [f.records[0]] : []),
            ...(kind !== 'message' ? [f.message] : []),
            ...(kind !== 'conversation' ? [f.conversation] : []),
            ...(kind === 'message'
              ? [
                  chat.bsky.convo.defs.messageRef.$build({
                    ...f.message,
                    convoId: 'other-conversation',
                  }),
                ]
              : []),
          ])
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
      const rude = com.atproto.moderation.defs.ReasonRude
      const created = await reports([
        f.account,
        f.records[0],
        f.records[0],
        { subject: f.records[0], reasonType: rude },
        { subject: f.account, reasonType: rude },
        { subject: f.records[0], reasonType: rude },
        f.records[1],
        f.message,
        f.conversation,
        other.account,
        other.records[0],
      ])
      const selected = created.slice(0, 4)
      const explicit = selected[3]
      const untouched = created.slice(4)
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
      const created = await reports([
        f.account,
        f[kind],
        f.records[0],
        kind === 'message' ? f.conversation : f.message,
        chat.bsky.convo.defs.messageRef.$build({
          ...f.message,
          convoId: 'other-conversation',
        }),
        chat.bsky.convo.defs.convoRef.$build({
          ...f.conversation,
          convoId: 'other-conversation',
        }),
        other[kind],
        other.account,
      ])
      const selected = created.slice(0, 2)
      const untouched = created.slice(2)
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
    const created = await reports([
      f.account,
      f.records[0],
      f.message,
      f.records[1],
      f.conversation,
    ])
    const selected = created.slice(0, 3)
    const untouched = created.slice(3)
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
      const candidates: [ReportSubjectTypes[number], ReportSubject][] = [
        ['account', f.account],
        ['record', f.records[0]],
        ['record', f.records[1]],
        ['message', f.message],
        ['conversation', f.conversation],
      ]
      const selectedSubject = candidates.find(([kind]) =>
        subjectTypes.includes(kind),
      )![1]
      const created = await reports([
        ...candidates.map(([, subject]) => subject),
        ...[f.account, selectedSubject].map((subject) => ({
          subject,
          reasonType: com.atproto.moderation.defs.ReasonRude,
        })),
        other.account,
        other.records[0],
        other.message,
        other.conversation,
      ])
      const selected: ReportRow[] = []
      const untouched: ReportRow[] = []
      for (const [i, [kind]] of candidates.entries()) {
        const matching = kind === 'account' || subjectTypes.includes(kind)
        ;(matching ? selected : untouched).push(created[i])
      }
      untouched.push(...created.slice(candidates.length))
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

  it.each([
    { selector: 'types', targeting: 'subjects' },
    { selector: 'all', targeting: 'subjects' },
    { selector: 'types', targeting: 'subjectTypes' },
    { selector: 'all', targeting: 'subjectTypes' },
  ])(
    'protects active reviews for $selector with $targeting and permits explicit account IDs',
    async ({ selector, targeting }) => {
      const f = await fixture()
      const protectedReports: ReportRow[] = []
      const selected: ReportRow[] = []
      const created = await reports(
        [f.account, f.records[0]].flatMap((subject) => [
          subject,
          subject,
          subject,
          subject,
        ]),
      )
      for (let i = 0; i < created.length; i += 4) {
        const [open, assigned, escalated, active] = created.slice(i, i + 4)
        selected.push(open)
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

  it.each(['owned', 'foreign', 'subjectTypes'] as const)(
    'lets allOwned override %s targeting',
    async (kind) => {
      const f = await fixture()
      const other = await fixture()
      const created = await reports([
        f.account,
        ...f.records,
        f.message,
        f.conversation,
        other.account,
        ...other.records,
        other.message,
        other.conversation,
      ])
      const selected = created.slice(0, 5)
      const untouched = created.slice(5)
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
})
