import { setTimeout as delay } from 'node:timers/promises'
import { jest } from '@jest/globals'
import { sql } from 'kysely'
import { ids } from '@atproto/api'
import type { ToolsOzoneModerationEmitEvent } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { asDatetimeString } from '@atproto/lex'
import { com, tools } from '../src/lexicons/index.js'
import { createReportActivity } from '../src/report/activity.js'
import {
  inboxHeaders,
  reportForEvent,
  withNotificationInsertFailure,
} from './_inbox.js'

describe('scheduled action reports', () => {
  let network: TestNetwork
  let sc: SeedClient
  let mod: ModeratorClient
  let fixtureNumber = 0
  const spam = com.atproto.moderation.defs.ReasonSpam
  const other = com.atproto.moderation.defs.ReasonOther

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_scheduled_action_reports',
    })
    sc = network.getSeedClient()
    mod = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => network?.close())

  async function fixture() {
    const name = `scheduledreports${++fixtureNumber}`
    const { did } = await sc.createAccount(name, {
      handle: `${name}.test`,
      email: `${name}@example.com`,
      password: 'password',
    })
    return { did, subject: com.atproto.admin.defs.repoRef.$build({ did }) }
  }

  async function report(
    subject: Parameters<ModeratorClient['emitEvent']>[0]['subject'],
    reasonType: string = spam,
    reportedBy = sc.dids.bob,
  ) {
    const event = await sc.createReport({
      subject,
      reasonType,
      reportedBy,
    })
    await network.processAll()
    return reportForEvent(mod, event.id)
  }

  async function schedule(
    did: string,
    reportAction?: ToolsOzoneModerationEmitEvent.ReportAction,
    subjects = [did],
  ) {
    const { data } = await mod.agent.tools.ozone.moderation.scheduleAction(
      {
        subjects,
        action: {
          $type: tools.ozone.moderation.scheduleAction.takedown.$type,
          comment: 'Example scheduled action',
          policies: ['spam'],
        },
        scheduling: { executeAt: new Date(Date.now() + 3600000).toISOString() },
        createdBy: sc.dids.alice,
        reportAction,
        modTool: {
          name: 'example-tool',
          meta: {
            source: 'example',
            rules: [{ name: 'example/rule', version: 1 }],
          },
        },
      },
      {
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneModerationScheduleAction,
        ),
      },
    )
    return data
  }

  async function accountAppeal() {
    const f = await fixture()
    const label = await mod.emitEvent({
      subject: f.subject,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
    })
    await sc.agent.tools.ozone.inbox.appealActionedSubject(
      {
        subject: f.subject,
        action: tools.ozone.inbox.appealActionedSubject.actionRef.$build({
          id: label.id,
        }),
      },
      { headers: inboxHeaders(network, sc, f.did) },
    )
    const { events } = await mod.queryEvents({
      subject: f.did,
      types: [tools.ozone.moderation.defs.modEventReport.$type],
    })
    const appeal = await reportForEvent(mod, events[0].id)
    expect(appeal.reportType).toBe(tools.ozone.report.defs.ReasonAppeal)
    return { ...f, appeal, history: await activities(appeal.id) }
  }

  async function actions(did: string) {
    return (
      await mod.agent.tools.ozone.moderation.listScheduledActions(
        {
          subjects: [did],
          statuses: ['pending', 'executed', 'failed', 'cancelled'],
        },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneModerationListScheduledActions,
          ),
        },
      )
    ).data.actions
  }

  async function activities(reportId: number) {
    return (
      await mod.agent.tools.ozone.report.listActivities(
        { reportId },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneReportListActivities,
          ),
        },
      )
    ).data.activities
  }

  async function activity(
    reportId: number,
    kind:
      | 'reopenActivity'
      | 'closeActivity'
      | 'assignmentActivity'
      | 'escalationActivity',
  ) {
    await mod.agent.tools.ozone.report.createActivity(
      { reportId, activity: { $type: `tools.ozone.report.defs#${kind}` } },
      {
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneReportCreateActivity,
        ),
      },
    )
  }

  function resolution(value: Awaited<ReturnType<typeof report>>) {
    const { status, actionNote, actionEventIds, updatedAt } = value
    return { status, actionNote, actionEventIds, updatedAt }
  }

  const processor = () => network.ozone.daemon.ctx.scheduledActionProcessor

  async function inboxReport(id: number, did = sc.dids.bob) {
    return (
      await sc.agent.tools.ozone.inbox.getReport(
        { id },
        { headers: inboxHeaders(network, sc, did) },
      )
    ).data
  }

  async function inboxReports(
    params: Partial<tools.ozone.inbox.listReports.$Params> = {},
    did = sc.dids.bob,
  ) {
    return (
      await sc.agent.tools.ozone.inbox.listReports(params, {
        headers: inboxHeaders(network, sc, did),
      })
    ).data
  }

  async function reportNotifications(reportId: number, did = sc.dids.bob) {
    const { data } = await sc.agent.tools.ozone.inbox.listNotifications(
      { reasons: ['reportResolved', 'reportReopened'], limit: 100 },
      { headers: inboxHeaders(network, sc, did) },
    )
    return data.notifications.filter(
      (n) => 'reportId' in n.target && n.target.reportId === reportId,
    )
  }

  async function assertPendingAppeal(
    f: Awaited<ReturnType<typeof accountAppeal>>,
  ) {
    expect(resolution(await reportForEvent(mod, f.appeal.eventId))).toEqual(
      resolution(f.appeal),
    )
    expect(await activities(f.appeal.id)).toEqual(f.history)
    const { data: detail } =
      await sc.agent.tools.ozone.inbox.getActionedSubject(
        { subject: f.did },
        { headers: inboxHeaders(network, sc, f.did) },
      )
    expect(detail.appeal?.state).toBe('pending')
    expect(detail.appeal).not.toHaveProperty('outcome')
    const { data } = await sc.agent.tools.ozone.inbox.listNotifications(
      { reasons: ['appealResolved'], limit: 100 },
      { headers: inboxHeaders(network, sc, f.did) },
    )
    expect(data.notifications).toEqual([])
  }

  it('keeps scheduled closures pending in inbox details and filters before pagination', async () => {
    const reporter = await fixture()
    const f = await fixture()
    const first = await report(f.subject, spam, reporter.did)
    const second = await report(f.subject, other, reporter.did)
    const resolved = await report(f.subject, spam, reporter.did)
    await activity(resolved.id, 'closeActivity')
    await schedule(f.did, { all: true })
    for (const row of [first, second]) {
      expect((await reportForEvent(mod, row.eventId)).status).toBe('closed')
      const detail = await inboxReport(row.id, reporter.did)
      expect(detail.report.status).toBe('pending')
      expect(detail.resolution).toBeUndefined()
      expect(await reportNotifications(row.id, reporter.did)).toEqual([])
    }
    for (const sortField of ['createdAt', 'updatedAt'] as const) {
      for (const sortDirection of ['asc', 'desc'] as const) {
        const ids: number[] = []
        let cursor: string | undefined
        do {
          const page = await inboxReports(
            { filter: 'pending', limit: 1, sortField, sortDirection, cursor },
            reporter.did,
          )
          expect(page.reports).toHaveLength(1)
          expect(page.reports[0].status).toBe('pending')
          ids.push(page.reports[0].id)
          cursor = page.cursor
          expect(ids.length).toBeLessThanOrEqual(2)
        } while (cursor)
        expect(ids.sort((a, b) => a - b)).toEqual([first.id, second.id])
      }
    }
    const page = await inboxReports({ filter: 'resolved' }, reporter.did)
    expect(page.reports.map((r) => r.id)).toEqual([resolved.id])
    await expect(inboxReport(first.id, sc.dids.carol)).rejects.toMatchObject({
      error: 'NotFound',
    })
  })

  it('resolves the inbox and notifies once at the actual execution time', async () => {
    const reporter = await fixture()
    const f = await fixture()
    const first = await report(f.subject, spam, reporter.did)
    await schedule(f.did, { all: true })
    const [scheduled] = await actions(f.did)
    const closed = await reportForEvent(mod, first.eventId)
    const history = await activities(first.id)
    await sc.agent.tools.ozone.inbox.updateSeen(
      { sections: ['reports'] },
      { headers: inboxHeaders(network, sc, reporter.did) },
    )
    expect(
      (await inboxReports({ filter: 'unread' }, reporter.did)).reports,
    ).toEqual([])
    await delay(5)
    await processor().executeScheduledAction(scheduled.id)
    await processor().executeScheduledAction(scheduled.id)
    const [execution] = (
      await mod.queryEvents({
        subject: f.did,
        types: [tools.ozone.moderation.defs.modEventTakedown.$type],
      })
    ).events
    const detail = await inboxReport(first.id, reporter.did)
    expect(detail.report).toMatchObject({
      status: 'resolved',
      updatedAt: execution.createdAt,
    })
    expect(detail.resolution).toMatchObject({
      outcome: 'actionTaken',
      actionTaken: 'accountTakedown',
      resolvedAt: execution.createdAt,
    })
    expect(detail.resolution!.resolvedAt).not.toBe(closed.updatedAt)
    expect(
      (await inboxReports({ filter: 'pending' }, reporter.did)).reports,
    ).toEqual([])
    for (const filter of ['resolved', 'unread'] as const) {
      expect(
        (await inboxReports({ filter }, reporter.did)).reports,
      ).toMatchObject([
        {
          id: first.id,
          status: 'resolved',
          lastActionTaken: 'accountTakedown',
          isRead: false,
        },
      ])
    }
    expect(await reportNotifications(first.id, reporter.did)).toMatchObject([
      { reason: 'reportResolved', createdAt: execution.createdAt },
    ])
    expect(await activities(first.id)).toEqual(history)
    expect(JSON.stringify(detail)).not.toContain('Example scheduled action')
  })

  it.each(['failed', 'cancelled'] as const)(
    'keeps all originally closed inbox reports pending when the schedule is %s',
    async (outcome) => {
      const f = await fixture()
      const reporter = await fixture()
      const first = await report(f.subject, spam, reporter.did)
      const second = await report(f.subject, spam, reporter.did)
      await schedule(f.did, { all: true })
      const [scheduled] = await actions(f.did)
      using failure = jest.spyOn(processor(), 'performTakedown')
      if (outcome === 'failed') {
        failure.mockRejectedValue(new Error('Example failure'))
      } else {
        await mod.agent.tools.ozone.moderation.cancelScheduledActions(
          { subjects: [f.did] },
          {
            headers: await network.ozone.modHeaders(
              ids.ToolsOzoneModerationCancelScheduledActions,
            ),
          },
        )
      }
      await processor().executeScheduledAction(scheduled.id)
      expect((await actions(f.did))[0].status).toBe(outcome)
      expect((await reportForEvent(mod, first.eventId)).status).toBe(
        outcome === 'failed' ? 'open' : 'closed',
      )
      expect((await reportForEvent(mod, second.eventId)).status).toBe('closed')
      expect(
        (await inboxReports({ filter: 'pending' }, reporter.did)).reports
          .map((r) => r.id)
          .sort((a, b) => a - b),
      ).toEqual([first.id, second.id])
      expect(
        (await inboxReports({ filter: 'resolved' }, reporter.did)).reports,
      ).toEqual([])
      for (const row of [first, second]) {
        expect(
          (await inboxReport(row.id, reporter.did)).resolution,
        ).toBeUndefined()
        expect(await reportNotifications(row.id, reporter.did)).toEqual([])
      }
    },
  )

  it('commits enforcement when the optional resolution notification fails', async () => {
    const f = await fixture()
    const first = await report(f.subject)
    await schedule(f.did, { all: true })
    const [scheduled] = await actions(f.did)
    await withNotificationInsertFailure(network.ozone.ctx.db, async () => {
      await processor().executeScheduledAction(scheduled.id)
    })
    expect((await actions(f.did))[0].status).toBe('executed')
    expect((await inboxReport(first.id)).resolution).toMatchObject({
      outcome: 'actionTaken',
      actionTaken: 'accountTakedown',
    })
    expect(await reportNotifications(first.id)).toEqual([])
  })

  it('resolves and notifies all originally closed reports across execution batches', async () => {
    const f = await fixture()
    const reporter = await fixture()
    const first = await report(f.subject, spam, reporter.did)
    // @NOTE Clone source rows to exercise the 500-row database batch boundary.
    const db = network.ozone.ctx.db
    const { id: eventId, ...event } = await db.db
      .selectFrom('moderation_event')
      .where('id', '=', first.eventId)
      .selectAll()
      .executeTakeFirstOrThrow()
    const {
      id: reportId,
      eventId: sourceId,
      ...row
    } = await db.db
      .selectFrom('report')
      .where('id', '=', first.id)
      .selectAll()
      .executeTakeFirstOrThrow()
    const events = await db.db
      .insertInto('moderation_event')
      .values(Array.from({ length: 500 }, () => event))
      .returning('id')
      .execute()
    await db.db
      .insertInto('report')
      .values(events.map(({ id }) => ({ ...row, eventId: id })))
      .execute()
    try {
      await schedule(f.did, { all: true })
      const [scheduled] = await actions(f.did)
      await processor().executeScheduledAction(scheduled.id)
      await processor().executeScheduledAction(scheduled.id)
      expect((await actions(f.did))[0].status).toBe('executed')
      expect(
        (await inboxReports({ filter: 'pending' }, reporter.did)).reports,
      ).toEqual([])
      const notifications: number[] = []
      let cursor: string | undefined
      do {
        const { data } = await sc.agent.tools.ozone.inbox.listNotifications(
          { reasons: ['reportResolved', 'reportReopened'], limit: 100, cursor },
          { headers: inboxHeaders(network, sc, reporter.did) },
        )
        for (const notification of data.notifications) {
          expect(notification.reason).toBe('reportResolved')
          expect('reportId' in notification.target).toBe(true)
          if ('reportId' in notification.target)
            notifications.push(notification.target.reportId)
        }
        cursor = data.cursor
        expect(notifications.length).toBeLessThanOrEqual(501)
      } while (cursor)
      expect(new Set(notifications).size).toBe(501)
      expect(notifications).toHaveLength(501)
      expect(
        (await inboxReport(Math.max(...notifications), reporter.did))
          .resolution,
      ).toMatchObject({
        outcome: 'actionTaken',
        actionTaken: 'accountTakedown',
      })
    } finally {
      const eventIds = events.map(({ id }) => id)
      await db.db
        .deleteFrom('report')
        .where('eventId', 'in', eventIds)
        .execute()
      await db.db
        .deleteFrom('moderation_event')
        .where('id', 'in', eventIds)
        .execute()
    }
  })

  it.each(['ids', 'types', 'all'] as const)(
    'closes %s targets immediately with scheduling history',
    async (selector) => {
      const f = await fixture()
      const first = await report(f.subject)
      const second = await report(f.subject, other)
      const selected =
        selector === 'ids'
          ? { ids: [first.id] }
          : selector === 'types'
            ? { types: [spam] }
            : { all: true }
      expect(
        await schedule(f.did, {
          ...selected,
          note: 'Scheduled review',
          isAutomated: true,
        }),
      ).toEqual({ succeeded: [f.did], failed: [] })
      const [scheduled] = await actions(f.did)
      expect(scheduled.status).toBe('pending')
      const closed = await reportForEvent(mod, first.eventId)
      expect(closed.status).toBe('closed')
      expect(closed.actionNote).toBe('Scheduled review')
      expect(closed.actionEventIds).toHaveLength(1)
      const event = await mod.queryEvents({
        subject: f.did,
        types: [tools.ozone.moderation.defs.scheduleTakedownEvent.$type],
      })
      expect(closed.actionEventIds).toEqual([event.events[0].id])
      expect(
        (await activities(first.id)).find((a) =>
          a.activity.$type.endsWith('#closeActivity'),
        ),
      ).toMatchObject({
        isAutomated: true,
        meta: {
          source: 'example',
          scheduledActionId: scheduled.id,
          actionEventId: event.events[0].id,
        },
      })
      expect((await reportForEvent(mod, second.eventId)).status).toBe(
        selector === 'all' ? 'closed' : second.status,
      )
      expect(
        (
          await mod.queryEvents({
            subject: f.did,
            types: [tools.ozone.moderation.defs.modEventTakedown.$type],
          })
        ).events,
      ).toEqual([])
    },
  )

  it.each([
    ['all', 'success'],
    ['types', 'success'],
    ['all', 'failure'],
    ['types', 'failure'],
  ] as const)(
    'preserves appeals selected by %s through scheduled %s',
    async (selector, outcome) => {
      const f = await accountAppeal()
      const selected = await report(f.subject)
      expect(
        await schedule(
          f.did,
          selector === 'all'
            ? { all: true }
            : { types: [spam, tools.ozone.report.defs.ReasonAppeal] },
        ),
      ).toEqual({ succeeded: [f.did], failed: [] })
      expect((await reportForEvent(mod, selected.eventId)).status).toBe(
        'closed',
      )
      await assertPendingAppeal(f)

      const [scheduled] = await actions(f.did)
      using takedown = jest.spyOn(processor(), 'performTakedown')
      if (outcome === 'failure') {
        takedown.mockRejectedValue(new Error('Example failure'))
      }
      await processor().executeScheduledAction(scheduled.id)
      expect((await actions(f.did))[0].status).toBe(
        outcome === 'success' ? 'executed' : 'failed',
      )
      expect((await reportForEvent(mod, selected.eventId)).status).toBe(
        outcome === 'success' ? 'closed' : 'open',
      )
      await assertPendingAppeal(f)
    },
  )

  it.each(['ids', 'ids and all', 'ids and types'] as const)(
    'rejects explicit appeal %s and rolls back scheduling and other closures',
    async (selector) => {
      const f = await accountAppeal()
      const selected = await report(f.subject)
      const result = await schedule(f.did, {
        ids: [selected.id, f.appeal.id],
        ...(selector === 'ids and all' ? { all: true } : {}),
        ...(selector === 'ids and types' ? { types: [spam] } : {}),
      })
      expect(result.succeeded).toEqual([])
      expect(result.failed).toHaveLength(1)
      expect(await actions(f.did)).toEqual([])
      expect(resolution(await reportForEvent(mod, selected.eventId))).toEqual(
        resolution(selected),
      )
      expect(
        (
          await mod.queryEvents({
            subject: f.did,
            types: [tools.ozone.moderation.defs.scheduleTakedownEvent.$type],
          })
        ).events,
      ).toEqual([])
      await assertPendingAppeal(f)
    },
  )

  it('allows scheduling when only appeals match a broad selector', async () => {
    const f = await accountAppeal()
    expect(
      await schedule(f.did, { types: [tools.ozone.report.defs.ReasonAppeal] }),
    ).toEqual({ succeeded: [f.did], failed: [] })
    await assertPendingAppeal(f)
  })

  it('preserves legacy scheduling without reportAction and allows zero broad matches', async () => {
    for (const selector of [undefined, { types: [other] }]) {
      const f = await fixture()
      const before = await report(f.subject)
      const history = await activities(before.id)
      expect((await schedule(f.did, selector)).succeeded).toEqual([f.did])
      expect(resolution(await reportForEvent(mod, before.eventId))).toEqual(
        resolution(before),
      )
      expect(await activities(before.id)).toEqual(history)
    }
  })

  it('rejects an empty selector before writing schedules', async () => {
    const f = await fixture()
    await expect(schedule(f.did, {})).rejects.toThrow(
      'reportAction must specify',
    )
    expect(await actions(f.did)).toEqual([])
  })

  it.each(['missing', 'foreign', 'closed'] as const)(
    'rolls back the subject when an explicit ID is %s',
    async (kind) => {
      const f = await fixture()
      const own = await report(f.subject)
      let id = -1
      if (kind === 'foreign') {
        const foreign = await fixture()
        id = (await report(foreign.subject)).id
      } else if (kind === 'closed') {
        const closed = await report(f.subject, other)
        await activity(closed.id, 'closeActivity')
        id = closed.id
      }
      const before = await reportForEvent(mod, own.eventId)
      const result = await schedule(f.did, { ids: [id], all: true })
      expect(result.succeeded).toEqual([])
      expect(result.failed).toHaveLength(1)
      expect(await actions(f.did)).toEqual([])
      expect(resolution(await reportForEvent(mod, own.eventId))).toEqual(
        resolution(before),
      )
      expect(
        (
          await mod.queryEvents({
            subject: f.did,
            types: [tools.ozone.moderation.defs.scheduleTakedownEvent.$type],
          })
        ).events,
      ).toEqual([])
    },
  )

  it('protects active reviews and owned records while explicit IDs remain deliberate', async () => {
    const f = await fixture()
    const assigned = await report(f.subject)
    const escalated = await report(f.subject)
    const explicit = await report(f.subject, other)
    const permanent = await report(f.subject)
    await mod.agent.tools.ozone.report.assignModerator(
      {
        reportId: permanent.id,
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
    await mod.agent.tools.ozone.report.createActivity(
      {
        reportId: permanent.id,
        activity: tools.ozone.report.defs.queueActivity.$build({}),
      },
      {
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneReportCreateActivity,
        ),
      },
    )
    await activity(assigned.id, 'assignmentActivity')
    await activity(escalated.id, 'escalationActivity')
    await activity(explicit.id, 'assignmentActivity')
    const post = await sc.post(f.did, 'Example record')
    const record = await report(
      com.atproto.repo.strongRef.$build({
        uri: post.ref.uriStr,
        cid: post.ref.cidStr,
      }),
    )
    await schedule(f.did, { ids: [explicit.id], types: [spam] })
    expect((await reportForEvent(mod, permanent.eventId)).status).toBe('queued')
    expect((await reportForEvent(mod, assigned.eventId)).status).toBe(
      'assigned',
    )
    expect((await reportForEvent(mod, escalated.eventId)).status).toBe(
      'escalated',
    )
    expect((await reportForEvent(mod, explicit.eventId)).status).toBe('closed')
    expect((await reportForEvent(mod, record.eventId)).status).toBe(
      record.status,
    )
  })

  it('links successful execution once without closing late reports', async () => {
    const f = await fixture()
    const first = await report(f.subject)
    await schedule(f.did, { all: true })
    const before = await reportForEvent(mod, first.eventId)
    const history = await activities(first.id)
    const late = await report(f.subject)
    const [scheduled] = await actions(f.did)
    await Promise.all([
      processor().executeScheduledAction(scheduled.id),
      processor().executeScheduledAction(scheduled.id),
    ])
    const [executed] = await actions(f.did)
    expect(executed.status).toBe('executed')
    const after = await reportForEvent(mod, first.eventId)
    expect(after.actionEventIds).toEqual([
      ...before.actionEventIds!,
      executed.executionEventId,
    ])
    expect(Date.parse(after.updatedAt!)).toBeGreaterThanOrEqual(
      Date.parse(before.updatedAt!),
    )
    expect(await activities(first.id)).toEqual(history)
    expect((await reportForEvent(mod, late.eventId)).status).toBe(late.status)
    expect(
      (
        await mod.queryEvents({
          subject: f.did,
          types: [tools.ozone.moderation.defs.modEventTakedown.$type],
        })
      ).events,
    ).toHaveLength(1)
  })

  it('reopens only the oldest linked report after failure and never repeats recovery', async () => {
    const f = await fixture()
    const first = await report(f.subject)
    const second = await report(f.subject)
    const unrelated = await report(f.subject, other)
    await schedule(f.did, { types: [spam] })
    const [scheduled] = await actions(f.did)
    using failure = jest.spyOn(processor(), 'performTakedown')
    failure.mockRejectedValue(new Error('Example execution failure'))
    await Promise.all([
      processor().executeScheduledAction(scheduled.id),
      processor().executeScheduledAction(scheduled.id),
    ])
    await processor().executeScheduledAction(scheduled.id)
    expect((await actions(f.did))[0]).toMatchObject({
      status: 'failed',
      lastFailureReason: 'Example execution failure',
    })
    expect((await reportForEvent(mod, first.eventId)).status).toBe('open')
    expect((await reportForEvent(mod, second.eventId)).status).toBe('closed')
    expect((await reportForEvent(mod, unrelated.eventId)).status).toBe(
      unrelated.status,
    )
    const reopens = (await activities(first.id)).filter((a) =>
      a.activity.$type.endsWith('#reopenActivity'),
    )
    expect(reopens).toHaveLength(1)
    expect(reopens[0]).toMatchObject({
      isAutomated: true,
      meta: {
        scheduledActionId: scheduled.id,
        failureReason: 'Example execution failure',
      },
    })
    expect(
      (await activities(second.id)).filter((a) =>
        a.activity.$type.endsWith('#reopenActivity'),
      ),
    ).toEqual([])
  })

  it.each(['failure', 'success'] as const)(
    'preserves a later independent closure on %s',
    async (outcome) => {
      const f = await fixture()
      const first = await report(f.subject)
      const second = await report(f.subject)
      await schedule(f.did, { all: true })
      await activity(first.id, 'reopenActivity')
      await activity(first.id, 'closeActivity')
      const before = await reportForEvent(mod, first.eventId)
      expect((await inboxReport(first.id)).resolution).toMatchObject({
        outcome: 'noAction',
      })
      const [scheduled] = await actions(f.did)
      using failure = jest.spyOn(processor(), 'performTakedown')
      if (outcome === 'failure')
        failure.mockRejectedValue(new Error('Example failure'))
      await processor().executeScheduledAction(scheduled.id)
      expect(resolution(await reportForEvent(mod, first.eventId))).toEqual(
        resolution(before),
      )
      expect((await reportForEvent(mod, second.eventId)).status).toBe(
        outcome === 'failure' ? 'open' : 'closed',
      )
      expect((await inboxReport(first.id)).resolution).toMatchObject({
        outcome: 'noAction',
      })
      expect((await inboxReport(second.id)).report.status).toBe(
        outcome === 'failure' ? 'pending' : 'resolved',
      )
    },
  )

  it('rolls back partial enforcement and database errors before recovery', async () => {
    const f = await fixture()
    const first = await report(f.subject)
    await schedule(f.did, { all: true })
    const [scheduled] = await actions(f.did)
    const perform = processor().performTakedown.bind(processor())
    using failure = jest.spyOn(processor(), 'performTakedown')
    failure.mockImplementation(async (args) => {
      const result = await perform(args)
      await sql`select 1 / 0`.execute(args.moderationTxn.db.db)
      return result
    })
    await processor().executeScheduledAction(scheduled.id)
    expect((await actions(f.did))[0].status).toBe('failed')
    expect((await reportForEvent(mod, first.eventId)).status).toBe('open')
    expect(
      (
        await mod.queryEvents({
          subject: f.did,
          types: [tools.ozone.moderation.defs.modEventTakedown.$type],
        })
      ).events,
    ).toEqual([])
  })

  it('recovers reports when the account is already taken down at execution', async () => {
    const f = await fixture()
    const first = await report(f.subject)
    await schedule(f.did, { all: true })
    await mod.emitEvent({
      subject: f.subject,
      event: tools.ozone.moderation.defs.modEventTakedown.$build({}),
    })
    const [scheduled] = await actions(f.did)
    await processor().executeScheduledAction(scheduled.id)
    expect((await actions(f.did))[0]).toMatchObject({
      status: 'failed',
      lastFailureReason: 'Account is already taken down',
    })
    expect((await reportForEvent(mod, first.eventId)).status).toBe('open')
  })

  it('keeps successful subjects when another bulk subject fails validation', async () => {
    const first = await fixture()
    const second = await fixture()
    const selected = await report(first.subject)
    const untouched = await report(second.subject)
    const result = await schedule(first.did, { ids: [selected.id] }, [
      first.did,
      second.did,
    ])
    expect(result.succeeded).toEqual([first.did])
    expect(result.failed).toMatchObject([{ subject: second.did }])
    expect((await reportForEvent(mod, selected.eventId)).status).toBe('closed')
    expect(resolution(await reportForEvent(mod, untouched.eventId))).toEqual(
      resolution(untouched),
    )
    expect(await actions(second.did)).toEqual([])
  })

  it('does not notify reporters about internal closure or failed recovery', async () => {
    const f = await fixture()
    const first = await report(f.subject)
    await schedule(f.did, { all: true })
    const [scheduled] = await actions(f.did)
    using failure = jest.spyOn(processor(), 'performTakedown')
    failure.mockRejectedValue(new Error('Example failure'))
    await processor().executeScheduledAction(scheduled.id)
    await processor().executeScheduledAction(scheduled.id)
    const { data } = await sc.agent.tools.ozone.inbox.listNotifications(
      { reasons: ['reportResolved', 'reportReopened'], limit: 100 },
      { headers: inboxHeaders(network, sc, sc.dids.bob) },
    )
    const rows = data.notifications.filter(
      (n) => 'reportId' in n.target && n.target.reportId === first.id,
    )
    expect(rows).toEqual([])
    expect(JSON.stringify(rows)).not.toContain('Example failure')
  })

  it('records failure without reopening unrelated or independently resolved reports', async () => {
    const f = await fixture()
    const first = await report(f.subject)
    await schedule(f.did, { all: true })
    await activity(first.id, 'reopenActivity')
    await activity(first.id, 'closeActivity')
    const before = await reportForEvent(mod, first.eventId)
    const [scheduled] = await actions(f.did)
    using failure = jest.spyOn(processor(), 'performTakedown')
    failure.mockRejectedValue(new Error('Example failure'))
    await processor().executeScheduledAction(scheduled.id)
    expect((await actions(f.did))[0].status).toBe('failed')
    expect(resolution(await reportForEvent(mod, first.eventId))).toEqual(
      resolution(before),
    )
  })

  it('breaks oldest-report timestamp ties by report ID', async () => {
    const f = await fixture()
    const first = await report(f.subject)
    const second = await report(f.subject)
    // @NOTE A timestamp tie is a database fixture with no API equivalent.
    await network.ozone.ctx.db.db
      .updateTable('report')
      .set({ createdAt: asDatetimeString(first.createdAt) })
      .where('id', '=', second.id)
      .execute()
    await schedule(f.did, { all: true })
    const [scheduled] = await actions(f.did)
    using failure = jest.spyOn(processor(), 'performTakedown')
    failure.mockRejectedValue(new Error('Example failure'))
    await processor().executeScheduledAction(scheduled.id)
    expect((await reportForEvent(mod, first.eventId)).status).toBe('open')
    expect((await reportForEvent(mod, second.eventId)).status).toBe('closed')
  })

  it.each(['failure', 'success'] as const)(
    'preserves a moderator closure committed while %s waits for the report lock',
    async (outcome) => {
      const f = await fixture()
      const first = await report(f.subject)
      const second = await report(f.subject)
      await schedule(f.did, { all: true })
      const before = await reportForEvent(mod, first.eventId)
      const [scheduled] = await actions(f.did)
      using failure = jest.spyOn(processor(), 'performTakedown')
      if (outcome === 'failure') {
        failure.mockRejectedValue(new Error('Example failure'))
      }
      let execution: Promise<void> | undefined
      try {
        // @NOTE Hold a real row lock to exercise PostgreSQL snapshot rechecks.
        await network.ozone.ctx.db.transaction(async (txn) => {
          const {
            rows: [backend],
          } = await sql<{
            pid: number
          }>`select pg_backend_pid() as pid`.execute(txn.db)
          await txn.db
            .selectFrom('report')
            .select('id')
            .where('id', '=', first.id)
            .forUpdate()
            .execute()
          execution = processor().executeScheduledAction(scheduled.id)
          let blocked = false
          for (let attempt = 0; attempt < 200; attempt++) {
            const {
              rows: [state],
            } = await sql<{
              blocked: boolean
            }>`select exists(select 1 from pg_stat_activity where ${backend.pid} = any(pg_blocking_pids(pid))) as blocked`.execute(
              network.ozone.ctx.db.db,
            )
            if (state.blocked) {
              blocked = true
              break
            }
            await delay(10)
          }
          expect(blocked).toBe(true)
          for (const activityType of [
            'reopenActivity',
            'closeActivity',
          ] as const) {
            await createReportActivity(txn, {
              reportId: first.id,
              activityType,
              createdBy: network.ozone.moderatorAccnt.did,
            })
          }
        })
      } finally {
        await execution
      }
      const after = await reportForEvent(mod, first.eventId)
      expect(after.status).toBe('closed')
      expect(after.actionEventIds).toEqual(before.actionEventIds)
      expect(
        (await activities(first.id)).filter((a) =>
          a.activity.$type.endsWith('#reopenActivity'),
        ),
      ).toHaveLength(1)
      expect((await reportForEvent(mod, second.eventId)).status).toBe(
        outcome === 'failure' ? 'open' : 'closed',
      )
      expect((await actions(f.did))[0].status).toBe(
        outcome === 'failure' ? 'failed' : 'executed',
      )
    },
  )

  it('does not reopen reports when a schedule is cancelled', async () => {
    const f = await fixture()
    const first = await report(f.subject)
    await schedule(f.did, { all: true })
    const [scheduled] = await actions(f.did)
    await mod.agent.tools.ozone.moderation.cancelScheduledActions(
      { subjects: [f.did] },
      {
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneModerationCancelScheduledActions,
        ),
      },
    )
    await processor().executeScheduledAction(scheduled.id)
    expect((await actions(f.did))[0].status).toBe('cancelled')
    expect((await reportForEvent(mod, first.eventId)).status).toBe('closed')
  })
})
