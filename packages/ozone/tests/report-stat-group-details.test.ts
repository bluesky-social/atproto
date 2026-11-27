import { sql } from 'kysely'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AtpAgent } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { com, tools } from '../src/lexicons/index.js'

const spam = com.atproto.moderation.defs.ReasonSpam
const threat = tools.ozone.report.defs.ReasonViolenceThreats

describe('report stat details', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let queueId: number
  let otherQueueId: number

  const headers = (nsid: string) => network.ozone.modHeaders(nsid, 'admin')

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_stat_group_details',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    // @NOTE Fixture queue assignments must remain stable between requests.
    await network.ozone.daemon.ctx.queueRouter.destroy()
    const db = network.ozone.ctx.db.db
    await db.deleteFrom('report_activity').execute()
    await db.deleteFrom('moderator_assignment').execute()
    await db.deleteFrom('report').execute()
    await db.deleteFrom('report_stat').execute()
    await db.deleteFrom('report_queue').execute()
    for (const name of ['Report type counts', 'Other report type counts']) {
      const { data } = await agent.tools.ozone.queue.createQueue(
        {
          name,
          subjectTypes: ['account'],
          reportTypes: name === 'Report type counts' ? [spam] : [],
        },
        {
          encoding: 'application/json',
          headers: await headers(tools.ozone.queue.createQueue.$lxm),
        },
      )
      if (queueId === undefined) queueId = data.queue.id
      else otherQueueId = data.queue.id
    }
  })

  beforeEach(async () => {
    const db = network.ozone.ctx.db.db
    await db.deleteFrom('report_activity').execute()
    await db.deleteFrom('report').execute()
    await db.deleteFrom('report_stat').execute()
  })

  afterAll(async () => network?.close())

  async function createReport(
    opts: {
      reason?: string
      status?: string
      muted?: boolean
      queue?: number | null
      assignedTo?: `did:${string}:${string}`
    } = {},
  ) {
    const event = await sc.createReport({
      reasonType: spam,
      subject: com.atproto.admin.defs.repoRef.$build({ did: sc.dids.bob }),
      reportedBy: sc.dids.alice,
    })
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    return network.ozone.ctx.db.db
      .updateTable('report')
      .set({
        queueId: opts.queue === undefined ? queueId : opts.queue,
        reportType: opts.reason ?? spam,
        assignedTo: opts.assignedTo ?? null,
        status: opts.status ?? 'queued',
        closedAt: opts.status === 'closed' ? sql.ref('createdAt') : null,
        isMuted: opts.muted ?? false,
      })
      .where('eventId', '=', event.id)
      .returning('id')
      .executeTakeFirstOrThrow()
  }

  async function live(
    queue = queueId,
    dateRange: { startDate?: string; endDate?: string } = {},
  ) {
    const { data } = await agent.tools.ozone.report.getStatGroupDetails(
      { queueId: queue, ...dateRange },
      { headers: await headers(tools.ozone.report.getStatGroupDetails.$lxm) },
    )
    return data
  }

  async function details(
    params: tools.ozone.report.getStatGroupDetails.$Params = {},
    role: 'admin' | 'moderator' = 'admin',
  ) {
    const { data } = await agent.tools.ozone.report.getStatGroupDetails(
      params,
      {
        headers: await network.ozone.modHeaders(
          tools.ozone.report.getStatGroupDetails.$lxm,
          role,
        ),
      },
    )
    return data
  }

  it('counts actual inbound reasons across all statuses, excluding muted reports and other queues', async () => {
    for (const status of [
      'open',
      'queued',
      'assigned',
      'escalated',
      'closed',
    ]) {
      await createReport({ status })
    }
    await createReport({ reason: threat })
    await createReport({ reason: 'example.report.defs#customReason' })
    await createReport({ muted: true })
    await createReport({ queue: otherQueueId })

    const data = await live()
    expect(data.computedAt).toBeDefined()
    expect(data.reportTypeBreakdown.totalCount).toBe(7)
    expect(data.reportTypeBreakdown.stats).toEqual([
      { reportType: spam, inboundCount: 5 },
      { reportType: 'example.report.defs#customReason', inboundCount: 1 },
      { reportType: threat, inboundCount: 1 },
    ])
    expect((await live(otherQueueId)).reportTypeBreakdown).toMatchObject({
      totalCount: 1,
      stats: [{ reportType: spam, inboundCount: 1 }],
    })
  })

  it('returns fresh counts without materialization, including empty queues', async () => {
    expect((await live()).reportTypeBreakdown).toMatchObject({
      totalCount: 0,
      stats: [],
    })
    await createReport({ reason: threat })
    expect((await live()).reportTypeBreakdown).toMatchObject({
      totalCount: 1,
      stats: [{ reportType: threat, inboundCount: 1 }],
    })
    await network.ozone.ctx.db.db
      .updateTable('report')
      .set({ isMuted: true })
      .where('queueId', '=', queueId)
      .execute()
    expect((await live()).reportTypeBreakdown).toMatchObject({
      totalCount: 0,
      stats: [],
    })
  })

  it('uses inclusive UTC calendar days and excludes reports outside the selected range', async () => {
    const fixtures = [
      ['2026-10-31T23:59:59.999Z', spam],
      ['2026-11-01T00:00:00.000Z', threat],
      ['2026-11-02T23:59:59.999Z', threat],
      ['2026-11-03T00:00:00.000Z', spam],
    ] as const
    for (const [createdAt, reason] of fixtures) {
      const report = await createReport({ reason })
      await network.ozone.ctx.db.db
        .updateTable('report')
        .set({ createdAt })
        .where('id', '=', report.id)
        .execute()
    }
    const params = {
      startDate: '2026-11-01T09:00:00.000Z',
      endDate: '2026-11-02T00:00:00.000Z',
    }
    const data = await live(queueId, params)
    expect(data.startDate).toBe('2026-11-01T00:00:00.000Z')
    expect(data.endDate).toBe('2026-11-02T00:00:00.000Z')
    expect(data.reportTypeBreakdown.totalCount).toBe(2)
    expect(data.reportTypeBreakdown.stats).toEqual([
      { reportType: threat, inboundCount: 2 },
    ])
    // A timestamp with an offset must select the corresponding UTC day.
    const shifted = await live(queueId, {
      startDate: '2026-10-31T23:00:00-02:00',
      endDate: params.endDate,
    })
    expect(shifted.reportTypeBreakdown.stats).toEqual(
      data.reportTypeBreakdown.stats,
    )
  })

  it('rejects invalid ranges and absent queues', async () => {
    await expect(
      live(queueId, {
        startDate: '2026-11-02T00:00:00.000Z',
        endDate: '2026-11-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ error: 'InvalidRequest' })
    await expect(
      live(queueId, {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-11-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ error: 'InvalidRequest' })
    await expect(live(2147483647)).rejects.toMatchObject({
      error: 'QueueNotFound',
    })
  })

  it('requires queue access and permits active queue members', async () => {
    await createReport({})
    const setStrictAccess = async (strictAccess: boolean) =>
      agent.tools.ozone.queue.updateQueue(
        { queueId, strictAccess },
        { headers: await headers(tools.ozone.queue.updateQueue.$lxm) },
      )
    await setStrictAccess(true)
    try {
      const moderatorOptions = {
        headers: await network.ozone.modHeaders(
          tools.ozone.report.getStatGroupDetails.$lxm,
          'moderator',
        ),
      }
      await expect(
        agent.tools.ozone.report.getStatGroupDetails(
          { queueId },
          moderatorOptions,
        ),
      ).rejects.toMatchObject({ error: 'QueueNotFound' })
      expect((await live()).reportTypeBreakdown.stats).toHaveLength(1)
      await agent.tools.ozone.queue.assignModerator(
        { queueId, did: network.ozone.moderatorAccnt.did },
        { headers: await headers(tools.ozone.queue.assignModerator.$lxm) },
      )
      const { data } = await agent.tools.ozone.report.getStatGroupDetails(
        { queueId },
        moderatorOptions,
      )
      expect(data.reportTypeBreakdown.stats).toEqual([
        { reportType: spam, inboundCount: 1 },
      ])
    } finally {
      await setStrictAccess(false)
    }
  })

  it('supports aggregate and report-type groups without combining selectors', async () => {
    await createReport()
    await createReport({ queue: otherQueueId, reason: threat })
    await createReport({ muted: true })
    expect((await details()).reportTypeBreakdown.totalCount).toBe(2)
    expect(
      (await details({ reportTypes: [threat] })).reportTypeBreakdown,
    ).toEqual({
      totalCount: 1,
      stats: [{ reportType: threat, inboundCount: 1 }],
    })
    for (const params of [
      { queueId, reportTypes: [spam] },
      { queueId, moderatorDid: sc.dids.alice },
      { moderatorDid: sc.dids.alice, reportTypes: [spam] },
      { queueId: 0 },
    ]) {
      await expect(details(params)).rejects.toMatchObject({
        error: 'InvalidRequest',
      })
    }
  })

  it('matches moderator groups by assignment and requires administrator access', async () => {
    await createReport({ assignedTo: sc.dids.alice })
    await createReport({ assignedTo: sc.dids.bob, reason: threat })
    await createReport()
    const params = { moderatorDid: sc.dids.alice }
    expect((await details(params)).reportTypeBreakdown).toEqual({
      totalCount: 1,
      stats: [{ reportType: spam, inboundCount: 1 }],
    })
    await expect(details(params, 'moderator')).rejects.toMatchObject({
      error: 'Forbidden',
    })
  })

  it('includes both null and -1 queue IDs in the unqueued group', async () => {
    await createReport({ queue: -1, reason: threat })
    await createReport()
    // @NOTE Later fixture creation runs the router and would assign null queues.
    await createReport({ queue: null })
    expect((await details({ queueId: -1 })).reportTypeBreakdown).toEqual({
      totalCount: 2,
      stats: [
        { reportType: spam, inboundCount: 1 },
        { reportType: threat, inboundCount: 1 },
      ],
    })
  })

  it('excludes inaccessible queues from aggregate and report-type details, while retaining unqueued reports', async () => {
    await createReport()
    await createReport({ queue: otherQueueId, reason: threat })
    await createReport({
      queue: null,
      reason: threat,
    })
    await agent.tools.ozone.queue.updateQueue(
      { queueId: otherQueueId, strictAccess: true },
      { headers: await headers(tools.ozone.queue.updateQueue.$lxm) },
    )
    try {
      expect((await details()).reportTypeBreakdown.totalCount).toBe(3)
      expect(
        (await details({}, 'moderator')).reportTypeBreakdown.totalCount,
      ).toBe(2)
      expect(
        (await details({ reportTypes: [threat] }, 'moderator'))
          .reportTypeBreakdown,
      ).toEqual({
        totalCount: 1,
        stats: [{ reportType: threat, inboundCount: 1 }],
      })
      expect(
        (await details({ queueId: -1 }, 'moderator')).reportTypeBreakdown
          .totalCount,
      ).toBe(1)
    } finally {
      await agent.tools.ozone.queue.updateQueue(
        { queueId: otherQueueId, strictAccess: false },
        { headers: await headers(tools.ozone.queue.updateQueue.$lxm) },
      )
    }
  })
})
