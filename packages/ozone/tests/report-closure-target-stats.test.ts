import { jest } from '@jest/globals'
import type { AtpAgent } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { type DidString, toDatetimeString } from '@atproto/lex'
import { com, tools } from '../src/lexicons/index.js'
import { REPORT_TYPE_GROUPS } from '../src/report/stats.js'

const minute = 60_000
const day = 24 * 60 * minute
const spam = com.atproto.moderation.defs.ReasonSpam
const other = com.atproto.moderation.defs.ReasonOther
const threat = tools.ozone.report.defs.ReasonViolenceThreats

describe('report closure target statistics', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let queueId: number
  let today: string
  let now: number

  const headers = (nsid: string) => network.ozone.modHeaders(nsid, 'admin')

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_closure_target_stats',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    const { data } = await agent.tools.ozone.queue.createQueue(
      {
        name: 'Closure target reports',
        subjectTypes: ['account'],
        reportTypes: [spam, other],
      },
      {
        encoding: 'application/json',
        headers: await headers(tools.ozone.queue.createQueue.$lxm),
      },
    )
    queueId = data.queue.id
  })

  beforeEach(async () => {
    const db = network.ozone.ctx.db.db
    await db.deleteFrom('report_activity').execute()
    await db.deleteFrom('report').execute()
    await db.deleteFrom('report_stat').execute()
    today = new Date().toISOString().slice(0, 10)
    now = Date.parse(`${today}T12:00:00.000Z`)
  })

  afterAll(async () => network?.close())

  async function createReport(opts: {
    createdAt: number
    closedAt?: number
    target?: number | null
    reason?: string
    queue?: number | null
    moderator?: DidString
    status?: string
    muted?: boolean
  }) {
    const event = await sc.createReport({
      reasonType: opts.reason ?? spam,
      subject: com.atproto.admin.defs.repoRef.$build({ did: sc.dids.bob }),
      reportedBy: sc.dids.alice,
    })
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    return network.ozone.ctx.db.db
      .updateTable('report')
      .set({
        createdAt: toDatetimeString(opts.createdAt),
        closedAt:
          opts.closedAt === undefined ? null : toDatetimeString(opts.closedAt),
        status:
          opts.status ?? (opts.closedAt === undefined ? 'open' : 'closed'),
        priorityTargetMinutes: opts.target === undefined ? 10 : opts.target,
        queueId: opts.queue === undefined ? queueId : opts.queue,
        assignedTo: opts.moderator ?? null,
        isMuted: opts.muted ?? false,
      })
      .where('eventId', '=', event.id)
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function computeLive() {
    jest.useFakeTimers({
      now,
      doNotFake: [
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
      ],
    })
    try {
      await network.ozone.ctx
        .reportStatsService(network.ozone.ctx.db)
        .materializeAll({ force: true })
    } finally {
      jest.useRealTimers()
    }
  }

  async function live(params: tools.ozone.report.getLiveStats.$Params = {}) {
    const { data } = await agent.tools.ozone.report.getLiveStats(params, {
      headers: await headers(tools.ozone.report.getLiveStats.$lxm),
    })
    return data.stats
  }

  async function refresh(
    startDate: string,
    endDate = startDate,
    queueIds?: number[],
  ) {
    await agent.tools.ozone.report.refreshStats(
      { startDate, endDate, queueIds },
      {
        encoding: 'application/json',
        headers: await headers(tools.ozone.report.refreshStats.$lxm),
      },
    )
  }

  async function history(
    startDate: string,
    endDate = startDate,
    filters: { queueId?: number; reportTypes?: string[] } = {},
  ) {
    const { data } = await agent.tools.ozone.report.getHistoricalStats(
      {
        startDate: `${startDate}T00:00:00.000Z`,
        endDate: `${endDate}T23:59:59.999Z`,
        ...filters,
      },
      { headers: await headers(tools.ozone.report.getHistoricalStats.$lxm) },
    )
    return data.stats
  }

  it('counts exact closure boundaries and excludes missing targets and invalid durations', async () => {
    for (const duration of [0, 10 * minute - 1, 10 * minute, 10 * minute + 1]) {
      await createReport({ createdAt: now - duration, closedAt: now })
    }
    await createReport({ createdAt: now - day, closedAt: now, target: null })
    await createReport({ createdAt: now + 1, closedAt: now })
    await createReport({
      createdAt: now - day,
      closedAt: now,
      target: 2_147_483_647,
    })
    await computeLive()
    expect(await live()).toMatchObject({
      closedCount: 7,
      closureTargetMetCount: 4,
      closureTargetMissedCount: 1,
      closureTargetMetRate: 80,
      pendingCount: 0,
      closureTargetOverdueCount: 0,
    })
  })

  it('combines counts across reasons and isolates queue and moderator groups', async () => {
    const moderator = network.ozone.moderatorAccnt.did
    await createReport({ createdAt: now - minute, closedAt: now, moderator })
    for (let i = 0; i < 3; i++) {
      await createReport({
        createdAt: now - 11 * minute,
        closedAt: now,
        reason: other,
      })
    }
    await createReport({
      createdAt: now - minute,
      closedAt: now,
      reason: threat,
      queue: null,
    })
    await createReport({
      createdAt: now - minute,
      closedAt: now,
      reason: threat,
      queue: -1,
    })
    await computeLive()
    expect(await live()).toMatchObject({
      closureTargetMetCount: 3,
      closureTargetMissedCount: 3,
      closureTargetMetRate: 50,
    })
    for (const filters of [
      { queueId },
      { reportTypes: REPORT_TYPE_GROUPS.Legacy },
    ]) {
      expect(await live(filters)).toMatchObject({
        closureTargetMetCount: 1,
        closureTargetMissedCount: 3,
        closureTargetMetRate: 25,
      })
    }
    expect(await live({ queueId: -1 })).toMatchObject({
      closureTargetMetCount: 2,
      closureTargetMissedCount: 0,
      closureTargetMetRate: 100,
    })
    const moderatorStats = await live({ moderatorDid: moderator })
    expect(moderatorStats).toMatchObject({
      closureTargetMetCount: 1,
      closureTargetMissedCount: 0,
      closureTargetMetRate: 100,
    })
    expect(moderatorStats.pendingCount).toBeUndefined()
    expect(moderatorStats.closureTargetOverdueCount).toBeUndefined()
    const { data } = await agent.tools.ozone.queue.listQueues(
      {},
      {
        headers: await headers(tools.ozone.queue.listQueues.$lxm),
      },
    )
    expect(
      data.queues.find((queue) => queue.id === queueId)?.stats,
    ).toMatchObject({
      closureTargetMetCount: 1,
      closureTargetMissedCount: 3,
      closureTargetMetRate: 25,
      closureTargetOverdueCount: 0,
    })
  })

  it('counts overdue pending reports at computation time using every pending status', async () => {
    for (const status of ['open', 'queued', 'assigned', 'escalated']) {
      await createReport({ createdAt: now - 10 * minute - 1, status })
    }
    await createReport({ createdAt: now - 10 * minute })
    await createReport({ createdAt: now - 10 * minute + 1 })
    await createReport({ createdAt: now - day, target: null })
    await createReport({ createdAt: now - day, target: 2_147_483_647 })
    await createReport({ createdAt: now - 11 * minute, closedAt: now })
    await computeLive()
    for (const filters of [
      {},
      { queueId },
      { reportTypes: REPORT_TYPE_GROUPS.Legacy },
    ]) {
      expect(await live(filters)).toMatchObject({
        pendingCount: 8,
        closureTargetOverdueCount: 4,
        closureTargetMetCount: 0,
        closureTargetMissedCount: 1,
        closureTargetMetRate: 0,
      })
    }
  })

  it('excludes muted backlog while retaining inbound volume and closure results', async () => {
    for (const queue of [queueId, null, -1]) {
      for (const status of ['open', 'queued', 'assigned', 'escalated']) {
        await createReport({
          createdAt: now - 11 * minute,
          queue,
          status,
          muted: true,
        })
      }
      await createReport({ createdAt: now - 11 * minute, queue })
    }
    for (const duration of [5 * minute, 15 * minute]) {
      await createReport({
        createdAt: now - duration,
        closedAt: now,
        muted: true,
      })
    }
    await computeLive()
    for (const filters of [{}, { reportTypes: REPORT_TYPE_GROUPS.Legacy }]) {
      expect(await live(filters)).toMatchObject({
        inboundCount: 17,
        pendingCount: 3,
        closureTargetOverdueCount: 3,
        closedCount: 2,
        acknowledgedCount: 2,
        resolutionSampleCount: 2,
        avgResolutionTimeSec: 600,
        closureTargetMetCount: 1,
        closureTargetMissedCount: 1,
        closureTargetMetRate: 50,
      })
    }
    expect(await live({ queueId })).toMatchObject({
      inboundCount: 7,
      pendingCount: 1,
      closureTargetOverdueCount: 1,
      closedCount: 2,
    })
    expect(await live({ queueId: -1 })).toMatchObject({
      inboundCount: 10,
      pendingCount: 2,
      closureTargetOverdueCount: 2,
      closedCount: 0,
    })
    const { data } = await agent.tools.ozone.queue.listQueues(
      {},
      { headers: await headers(tools.ozone.queue.listQueues.$lxm) },
    )
    expect(
      data.queues.find((queue) => queue.id === queueId)?.stats,
    ).toMatchObject({ pendingCount: 1, closureTargetOverdueCount: 1 })
  })

  it('uses the selected historical boundary rather than the current age', async () => {
    const cutoff = Date.parse('2020-01-02T00:00:00.000Z')
    for (const age of [10 * minute - 1, 10 * minute, 10 * minute + 1]) {
      await createReport({ createdAt: cutoff - age })
    }
    await createReport({ createdAt: cutoff - day, target: null })
    await refresh('2020-01-01', '2020-01-02')
    for (const filters of [
      {},
      { queueId },
      { reportTypes: REPORT_TYPE_GROUPS.Legacy },
    ]) {
      const rows = await history('2020-01-01', '2020-01-02', filters)
      expect(rows.find((row) => row.date === '2020-01-01')).toMatchObject({
        pendingCount: 4,
        closureTargetOverdueCount: 1,
      })
      expect(rows.find((row) => row.date === '2020-01-02')).toMatchObject({
        pendingCount: 4,
        closureTargetOverdueCount: 3,
      })
    }
  })

  it.each([
    {
      name: 'muted report still open',
      offsets: [],
      pending: 0,
      muted: true,
    },
    {
      name: 'muted report closed after midnight',
      offsets: [1],
      pending: 0,
      muted: true,
    },
    {
      name: 'muted report closed then reopened after midnight',
      offsets: [1, minute],
      pending: 0,
      muted: true,
    },
    { name: 'closed before midnight', offsets: [-1], pending: 0 },
    { name: 'closed exactly at midnight', offsets: [0], pending: 1 },
    { name: 'closed after midnight', offsets: [1], pending: 1 },
    { name: 'reopened exactly at midnight', offsets: [-minute, 0], pending: 0 },
    { name: 'reopened before midnight', offsets: [-minute, -1], pending: 1 },
    {
      name: 'reopened before and reclosed after midnight',
      offsets: [-minute, -1, 1],
      pending: 1,
    },
    {
      name: 'closed then reopened after midnight',
      offsets: [1, minute],
      pending: 1,
    },
    {
      name: 'close and reopen at the same boundary',
      offsets: [0, 0],
      pending: 1,
    },
  ])(
    'reconstructs historical overdue membership: $name',
    async ({ offsets, pending, muted }) => {
      const cutoff = Date.parse('2020-01-02T00:00:00.000Z')
      const closed = offsets.length % 2 === 1
      const report = await createReport({
        createdAt: cutoff - 20 * minute,
        closedAt: closed ? cutoff + offsets.at(-1)! : undefined,
        muted,
      })
      const db = network.ozone.ctx.db.db
      await db
        .deleteFrom('report_activity')
        .where('reportId', '=', report.id)
        .execute()
      for (const [index, offset] of offsets.entries()) {
        await db
          .insertInto('report_activity')
          .values({
            reportId: report.id,
            activityType: index % 2 === 0 ? 'closeActivity' : 'reopenActivity',
            previousStatus: index % 2 === 0 ? 'open' : 'closed',
            createdAt: toDatetimeString(cutoff + offset),
            createdBy: sc.dids.alice,
            isAutomated: false,
          })
          .execute()
      }
      await refresh('2020-01-01')
      for (const filters of [
        {},
        { queueId },
        { reportTypes: REPORT_TYPE_GROUPS.Legacy },
      ]) {
        expect(
          (await history('2020-01-01', '2020-01-01', filters))[0],
        ).toMatchObject({
          pendingCount: pending,
          closureTargetOverdueCount: pending,
        })
      }
    },
  )

  it('uses the new closure day and original target after reopening', async () => {
    const createdAt = Date.parse('2020-01-01T23:55:00.000Z')
    const report = await createReport({
      createdAt,
      closedAt: createdAt + 4 * minute,
    })
    await refresh('2020-01-01')
    expect((await history('2020-01-01'))[0]).toMatchObject({
      closureTargetMetCount: 1,
      closureTargetMissedCount: 0,
    })
    const db = network.ozone.ctx.db.db
    await db
      .updateTable('report')
      .set({ status: 'open', closedAt: null })
      .where('id', '=', report.id)
      .execute()
    await refresh('2020-01-01')
    expect((await history('2020-01-01'))[0]).toMatchObject({
      closureTargetMetCount: 0,
      closureTargetMissedCount: 0,
    })
    await db
      .updateTable('report')
      .set({
        status: 'closed',
        closedAt: toDatetimeString(createdAt + 11 * minute),
      })
      .where('id', '=', report.id)
      .execute()
    await refresh('2020-01-01', '2020-01-02')
    const rows = await history('2020-01-01', '2020-01-02')
    expect(rows.find((row) => row.date === '2020-01-01')).toMatchObject({
      closureTargetMetCount: 0,
      closureTargetMissedCount: 0,
    })
    expect(rows.find((row) => row.date === '2020-01-02')).toMatchObject({
      closureTargetMetCount: 0,
      closureTargetMissedCount: 1,
      closureTargetMetRate: 0,
    })
  })

  it('omits closure target met rate when no closed reports have a target', async () => {
    await createReport({ createdAt: now - minute, closedAt: now, target: null })
    await computeLive()
    const stats = await live()
    expect(stats).toMatchObject({
      closureTargetMetCount: 0,
      closureTargetMissedCount: 0,
      closureTargetOverdueCount: 0,
    })
    expect(stats.closureTargetMetRate).toBeUndefined()
  })

  it('preserves missing legacy metrics in historical ranges until explicitly refreshed', async () => {
    const db = network.ozone.ctx.db.db
    await db
      .insertInto('report_stat')
      .values({
        date: '2020-01-01',
        computedAt: toDatetimeString(Date.now()),
        closedCount: 50,
      })
      .execute()
    const createdAt = Date.parse('2020-01-02T12:00:00.000Z')
    await createReport({ createdAt, closedAt: createdAt + minute })
    await refresh('2020-01-02')
    const rows = await history('2020-01-01', '2020-01-02')
    const legacy = rows.find((row) => row.date === '2020-01-01')!
    for (const metric of [
      'closureTargetMetCount',
      'closureTargetMissedCount',
      'closureTargetMetRate',
      'closureTargetOverdueCount',
    ] as const) {
      expect(legacy[metric]).toBeUndefined()
    }
    expect(rows.find((row) => row.date === '2020-01-02')).toMatchObject({
      closureTargetMetCount: 1,
      closureTargetMissedCount: 0,
      closureTargetMetRate: 100,
      closureTargetOverdueCount: 0,
    })
    await refresh('2020-01-01')
    const refreshed = (await history('2020-01-01'))[0]
    expect(refreshed).toMatchObject({
      closureTargetMetCount: 0,
      closureTargetMissedCount: 0,
      closureTargetOverdueCount: 0,
    })
    expect(refreshed.closureTargetMetRate).toBeUndefined()
  })

  it('omits closure target met rate for partially populated historical counts', async () => {
    const db = network.ozone.ctx.db.db
    await db
      .insertInto('report_stat')
      .values({
        date: '2020-01-01',
        computedAt: toDatetimeString(Date.now()),
        closureTargetMetCount: 4,
      })
      .execute()
    const stats = (await history('2020-01-01'))[0]
    expect(stats.closureTargetMetCount).toBe(4)
    expect(stats.closureTargetMissedCount).toBeUndefined()
    expect(stats.closureTargetMetRate).toBeUndefined()
  })
})
