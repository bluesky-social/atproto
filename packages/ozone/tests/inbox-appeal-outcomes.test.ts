import { jest } from '@jest/globals'
import type { CompiledQuery } from 'kysely'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { com, tools } from '../src/lexicons/index.js'
import { inboxHeaders } from './_inbox.js'

describe('viewer appeal outcomes', () => {
  let network: TestNetwork
  let sc: SeedClient
  let mod: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_inbox_appeal_outcomes',
    })
    sc = network.getSeedClient()
    mod = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })
  afterAll(async () => network?.close())

  async function startAppeal(
    kind: 'label' | 'takedown' = 'label',
    scope: 'record' | 'account' = 'record',
  ) {
    const post =
      scope === 'record' ? await sc.post(sc.dids.alice, 'Appeal outcome') : null
    const subject = post
      ? com.atproto.repo.strongRef.$build({
          uri: post.ref.uriStr,
          cid: post.ref.cidStr,
        })
      : com.atproto.admin.defs.repoRef.$build({ did: sc.dids.alice })
    await network.processAll()
    const action = await mod.emitEvent({
      subject,
      event:
        kind === 'label'
          ? {
              $type: tools.ozone.moderation.defs.modEventLabel.$type,
              createLabelVals: ['spam'],
              negateLabelVals: [],
            }
          : { $type: tools.ozone.moderation.defs.modEventTakedown.$type },
    })
    const { data: pending } =
      await sc.agent.tools.ozone.inbox.appealActionedSubject(
        {
          subject,
          action: {
            $type: tools.ozone.inbox.appealActionedSubject.actionRef.$type,
            id: action.id,
          },
          reason: 'PRIVATE APPEAL TEXT',
        },
        { headers: inboxHeaders(network, sc, sc.dids.alice) },
      )
    expect(pending.appeal?.state).toBe('pending')
    expect(pending.appeal).not.toHaveProperty('outcome')
    const subjectId = post?.ref.uriStr ?? sc.dids.alice
    const reports = (
      await Promise.all(
        ['open', 'queued', 'assigned', 'escalated'].map((status) =>
          mod.queryReports({
            subject: subjectId,
            status,
            reportTypes: [tools.ozone.report.defs.ReasonAppeal],
          }),
        ),
      )
    )
      .flatMap((page) => page.reports)
      .sort((a, b) => b.id - a.id)
    if (!reports[0]) throw new Error('Appeal report not found')
    expect(reports[0].actionEventIds).toEqual([action.id])
    return { subject, subjectId, reportId: reports[0].id, action }
  }

  function matchesSubject(subject: unknown, subjectId: string) {
    if (com.atproto.repo.strongRef.$matches(subject))
      return subject.uri === subjectId
    if (com.atproto.admin.defs.repoRef.$matches(subject))
      return subject.did === subjectId
    return false
  }

  async function detail(subjectId: string) {
    return (
      await sc.agent.tools.ozone.inbox.getActionedSubject(
        { subject: subjectId },
        { headers: inboxHeaders(network, sc, sc.dids.alice) },
      )
    ).data
  }

  async function resolutionNotifications(subjectId: string) {
    const { data } = await sc.agent.tools.ozone.inbox.listNotifications(
      { reasons: ['appealResolved'] },
      { headers: inboxHeaders(network, sc, sc.dids.alice) },
    )
    return data.notifications.filter(
      (notification) =>
        tools.ozone.inbox.defs.subjectRef.$matches(notification.target) &&
        matchesSubject(notification.target.subject, subjectId),
    )
  }

  async function assertOutcome(
    subjectId: string,
    outcome: 'approved' | 'denied',
  ) {
    const view = await detail(subjectId)
    expect(view.appeal).toMatchObject({
      state: 'resolved',
      outcome,
      resolvedAt: expect.any(String),
    })
    const { data } = await sc.agent.tools.ozone.inbox.listActionedSubjects(
      { filter: 'resolved', limit: 100 },
      { headers: inboxHeaders(network, sc, sc.dids.alice) },
    )
    expect(
      data.subjects.find((view) => matchesSubject(view.subject, subjectId))
        ?.appeal,
    ).toEqual(view.appeal)
    const notifications = await resolutionNotifications(subjectId)
    expect(notifications[0]?.target).toMatchObject({ appealOutcome: outcome })
    expect(JSON.stringify({ view, notifications })).not.toMatch(/PRIVATE/)
    return notifications[0]
  }

  async function activity(
    reportId: number,
    type: 'closeActivity' | 'reopenActivity',
  ) {
    return network.ozone.getAgent().tools.ozone.report.createActivity(
      {
        reportId,
        activity: {
          $type:
            type === 'closeActivity'
              ? tools.ozone.report.defs.closeActivity.$type
              : tools.ozone.report.defs.reopenActivity.$type,
        },
        internalNote: 'PRIVATE MODERATOR NOTE',
        publicNote: 'PRIVATE PUBLIC NOTE',
      },
      {
        headers: await network.ozone.modHeaders(
          tools.ozone.report.createActivity.$lxm,
        ),
      },
    )
  }

  it.each(['record', 'account'] as const)(
    'exposes denial for a %s appeal closed as no-action',
    async (scope) => {
      const appeal = await startAppeal('label', scope)
      await mod.emitEvent({
        subject: appeal.subject,
        event: {
          $type: tools.ozone.moderation.defs.modEventResolveAppeal.$type,
        },
      })
      await activity(appeal.reportId, 'closeActivity')
      await assertOutcome(appeal.subjectId, 'denied')
    },
  )

  it('exposes denial for appeals closed in bulk', async () => {
    const appeal = await startAppeal()
    await network.ozone.getAgent().tools.ozone.report.closeReports(
      {
        subject: appeal.subjectId,
        reportTypes: [tools.ozone.report.defs.ReasonAppeal],
        internalNote: 'PRIVATE BULK NOTE',
      },
      {
        headers: await network.ozone.modHeaders(
          tools.ozone.report.closeReports.$lxm,
        ),
      },
    )
    await assertOutcome(appeal.subjectId, 'denied')
  })

  it.each(['record', 'account'] as const)(
    'exposes approval for a %s label appeal closed by label removal',
    async (scope) => {
      const appeal = await startAppeal('label', scope)
      await mod.emitEvent({
        subject: appeal.subject,
        event: {
          $type: tools.ozone.moderation.defs.modEventLabel.$type,
          createLabelVals: [],
          negateLabelVals: ['spam'],
        },
        reportAction: {
          ids: [appeal.reportId],
          note: 'PRIVATE RESOLUTION NOTE',
        },
      })
      await assertOutcome(appeal.subjectId, 'approved')
    },
  )

  it.each(['record', 'account'] as const)(
    'closes and attaches the reversal for an approved %s takedown appeal',
    async (scope) => {
      const appeal = await startAppeal('takedown', scope)
      const reversed = await mod.emitEvent({
        subject: appeal.subject,
        event: {
          $type: tools.ozone.moderation.defs.modEventReverseTakedown.$type,
        },
        reportAction: { ids: [appeal.reportId], note: 'PRIVATE REVERSAL NOTE' },
      })
      const { reports } = await mod.queryReports({
        subject: appeal.subjectId,
        status: 'closed',
      })
      expect(
        reports.find((report) => report.id === appeal.reportId)?.actionEventIds,
      ).toEqual([appeal.action.id, reversed.id])
      await assertOutcome(appeal.subjectId, 'approved')
    },
  )

  it('does not infer approval from a new label applied while closing an appeal', async () => {
    const appeal = await startAppeal()
    await mod.emitEvent({
      subject: appeal.subject,
      event: {
        $type: tools.ozone.moderation.defs.modEventLabel.$type,
        createLabelVals: ['porn'],
        negateLabelVals: [],
      },
      reportAction: { ids: [appeal.reportId] },
    })
    await assertOutcome(appeal.subjectId, 'denied')
  })

  it('uses the latest closure after reopen and preserves earlier notification outcomes', async () => {
    const appeal = await startAppeal()
    await mod.emitEvent({
      subject: appeal.subject,
      event: {
        $type: tools.ozone.moderation.defs.modEventLabel.$type,
        createLabelVals: [],
        negateLabelVals: ['spam'],
      },
      reportAction: { ids: [appeal.reportId] },
    })
    const approved = await assertOutcome(appeal.subjectId, 'approved')
    await activity(appeal.reportId, 'reopenActivity')
    expect((await detail(appeal.subjectId)).appeal).toMatchObject({
      state: 'pending',
    })
    expect((await detail(appeal.subjectId)).appeal).not.toHaveProperty(
      'outcome',
    )
    await activity(appeal.reportId, 'closeActivity')
    await assertOutcome(appeal.subjectId, 'denied')
    expect(
      (await resolutionNotifications(appeal.subjectId)).find(
        (n) => n.id === approved.id,
      )?.target,
    ).toMatchObject({ appealOutcome: 'approved' })
  })

  it('bounds latest-appeal and closure lookups by the subject page despite repeated appeals', async () => {
    let subjectId = ''
    for (let i = 0; i < 6; i++) {
      const appeal = await startAppeal('label', 'account')
      subjectId = appeal.subjectId
      if (i === 5) {
        await mod.emitEvent({
          subject: appeal.subject,
          event: {
            $type: tools.ozone.moderation.defs.modEventLabel.$type,
            createLabelVals: [],
            negateLabelVals: ['spam'],
          },
          reportAction: { ids: [appeal.reportId] },
        })
      } else {
        await activity(appeal.reportId, 'closeActivity')
      }
    }
    await assertOutcome(subjectId, 'approved')

    let query: CompiledQuery<unknown> | undefined
    let subjectCount: number
    {
      using queries = jest.spyOn(
        network.ozone.ctx.db.db.getExecutor(),
        'executeQuery',
      )
      const { data } = await sc.agent.tools.ozone.inbox.listActionedSubjects(
        { filter: 'resolved', limit: 100 },
        { headers: inboxHeaders(network, sc, sc.dids.alice) },
      )
      subjectCount = data.subjects.length
      query = queries.mock.calls
        .map(([compiled]) => compiled)
        .find((compiled) => compiled.sql.includes('report_activity'))
    }
    if (!query) throw new Error('Appeal hydration query not captured')

    // @NOTE Check executed work, not SQL spelling: historical appeals must
    // not multiply report rows or closure lookups for a resolved page.
    type PlanNode = {
      'Relation Name'?: string
      'Actual Rows': number
      'Actual Loops': number
      Plans?: PlanNode[]
    }
    const { rows } = await network.ozone.ctx.db.pool.query<{
      'QUERY PLAN': { Plan: PlanNode }[]
    }>(`EXPLAIN (ANALYZE, FORMAT JSON) ${query.sql}`, [...query.parameters])
    function nodes(plan: PlanNode): PlanNode[] {
      return [plan, ...(plan.Plans ?? []).flatMap(nodes)]
    }
    const plan = nodes(rows[0]['QUERY PLAN'][0].Plan)
    const reportScan = plan.find((node) => node['Relation Name'] === 'report')
    const closureScan = plan.find(
      (node) => node['Relation Name'] === 'report_activity',
    )
    expect(reportScan?.['Actual Rows']).toBe(1)
    expect(reportScan?.['Actual Loops']).toBe(subjectCount)
    expect(closureScan?.['Actual Loops']).toBe(subjectCount)
  })

  it.each(['legacy', 'challenged action', 'malformed action'] as const)(
    'omits outcomes for a %s closure without trustworthy resolution evidence',
    async (kind) => {
      const appeal = await startAppeal()
      const closed = await activity(appeal.reportId, 'closeActivity')
      // @NOTE Historical/malformed metadata cannot be written by the current API.
      await network.ozone.ctx.db.db
        .updateTable('report_activity')
        .set({
          meta:
            kind === 'legacy'
              ? null
              : {
                  actionEventId:
                    kind === 'challenged action'
                      ? appeal.action.id
                      : '999999999999999999999',
                },
        })
        .where('id', '=', closed.data.activity.id)
        .execute()
      expect((await detail(appeal.subjectId)).appeal).toMatchObject({
        state: 'resolved',
      })
      expect((await detail(appeal.subjectId)).appeal).not.toHaveProperty(
        'outcome',
      )
    },
  )
})
