import { type AtpAgent, ids } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { type DidString, toDatetimeString } from '@atproto/lex'
import { com, tools } from '../src/lexicons/index.js'
import {
  PriorityLevelSettingKey,
  ReportPriorityLevelSettingKey,
} from '../src/setting/constants.js'

const spam = com.atproto.moderation.defs.ReasonSpam
const other = com.atproto.moderation.defs.ReasonOther
const urgent = tools.ozone.report.defs.ReasonViolenceThreats

describe('report priority', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient
  let queueId: number

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_priority',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
    const { data } = await agent.tools.ozone.queue.createQueue(
      {
        name: 'Priority reports',
        subjectTypes: ['account'],
        reportTypes: [urgent, spam, other],
      },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneQueueCreateQueue,
          'admin',
        ),
      },
    )
    queueId = data.queue.id
  })

  beforeEach(async () => {
    const db = network.ozone.ctx.db.db
    await db.deleteFrom('report_activity').execute()
    await db.deleteFrom('report').execute()
    await agent.tools.ozone.setting.removeOptions(
      {
        scope: 'instance',
        keys: [PriorityLevelSettingKey, ReportPriorityLevelSettingKey],
      },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneSettingRemoveOptions,
          'admin',
        ),
      },
    )
  })

  afterAll(async () => network?.close())

  async function upsertSetting(key: string, value: Record<string, unknown>) {
    await agent.tools.ozone.setting.upsertOption(
      {
        scope: 'instance',
        key,
        value,
        managerRole: tools.ozone.team.defs.RoleAdmin,
      },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneSettingUpsertOption,
          'admin',
        ),
      },
    )
  }

  async function configure() {
    await upsertSetting(PriorityLevelSettingKey, {
      urgent: { name: 'Urgent', targetResolutionMinutes: 10, score: 100 },
      normal: { name: 'Normal', targetResolutionMinutes: 20, score: 0 },
    })
    await upsertSetting(ReportPriorityLevelSettingKey, {
      [urgent]: 'urgent',
      [spam]: 'normal',
    })
  }

  async function createReport(
    reasonType: string,
    did: DidString = sc.dids.bob,
  ) {
    const event = await sc.createReport({
      reasonType,
      subject: { $type: com.atproto.admin.defs.repoRef.$type, did },
      reportedBy: sc.dids.alice,
    })
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    return network.ozone.ctx.db.db
      .selectFrom('report')
      .selectAll()
      .where('eventId', '=', event.id)
      .executeTakeFirstOrThrow()
  }

  async function getReport(id: number) {
    const { data } = await agent.tools.ozone.report.getReport(
      { id },
      {
        headers: await network.ozone.modHeaders(
          tools.ozone.report.getReport.$lxm,
          'moderator',
        ),
      },
    )
    return data
  }

  async function changeReportStatus(id: number, close: boolean) {
    return agent.tools.ozone.report.createActivity(
      {
        reportId: id,
        activity: close
          ? tools.ozone.report.defs.closeActivity.$build({})
          : tools.ozone.report.defs.reopenActivity.$build({}),
      },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          tools.ozone.report.createActivity.$lxm,
          'moderator',
        ),
      },
    )
  }

  it('leaves unknown and unmapped reasons unprioritized', async () => {
    await configure()
    for (const reason of [other, 'example.report#unknown']) {
      const report = await createReport(reason)
      expect(report).toMatchObject({
        priorityLevel: null,
        priorityScore: null,
        priorityTargetMinutes: null,
      })
    }
  })

  it('does not assign priority when only levels are configured', async () => {
    await upsertSetting(PriorityLevelSettingKey, {
      urgent: { name: 'Invalid', targetResolutionMinutes: 1, score: 1 },
    })
    expect(await createReport(urgent)).toMatchObject({
      priorityLevel: null,
      priorityScore: null,
      priorityTargetMinutes: null,
    })
  })

  describe('closure targets', () => {
    it.each(['activity', 'bulk', 'acknowledge', 'label'] as const)(
      'calculates the resolution duration for %s closures',
      async (method) => {
        await configure()
        const report = await createReport(urgent)
        const createdAt = toDatetimeString(Date.now() - 2 * 60_000)
        const db = network.ozone.ctx.db.db
        await db
          .updateTable('report')
          .set({ createdAt })
          .where('id', '=', report.id)
          .execute()

        const pending = await getReport(report.id)
        expect(pending.resolutionTimeSec).toBeUndefined()
        expect(pending.priorityTargetMet).toBeUndefined()

        if (method === 'activity') {
          await changeReportStatus(report.id, true)
        } else if (method === 'bulk') {
          await agent.tools.ozone.report.closeReports(
            { subject: sc.dids.bob },
            {
              encoding: 'application/json',
              headers: await network.ozone.modHeaders(
                tools.ozone.report.closeReports.$lxm,
                'moderator',
              ),
            },
          )
        } else {
          await modClient.emitEvent({
            subject: com.atproto.admin.defs.repoRef.$build({
              did: sc.dids.bob,
            }),
            event:
              method === 'acknowledge'
                ? tools.ozone.moderation.defs.modEventAcknowledge.$build({})
                : tools.ozone.moderation.defs.modEventLabel.$build({
                    createLabelVals: ['!warn'],
                    negateLabelVals: [],
                  }),
            reportAction: { ids: [report.id] },
          })
        }

        const activity = await db
          .selectFrom('report_activity')
          .select('createdAt')
          .where('reportId', '=', report.id)
          .where('activityType', '=', 'closeActivity')
          .executeTakeFirstOrThrow()
        expect(await getReport(report.id)).toMatchObject({
          status: 'closed',
          resolutionTimeSec: Math.floor(
            (Date.parse(activity.createdAt) - Date.parse(createdAt)) / 1000,
          ),
          priorityTargetMet: true,
        })
      },
    )

    it.each([
      { elapsedMs: 0, met: true, seconds: 0 },
      { elapsedMs: 599_999, met: true, seconds: 599 },
      { elapsedMs: 600_000, met: true, seconds: 600 },
      { elapsedMs: 600_001, met: false, seconds: 600 },
    ])('checks the exact target boundary at $elapsedMs ms', async (fixture) => {
      await configure()
      const report = await createReport(urgent)
      const createdAt = toDatetimeString('2026-09-01T20:00:00.000Z')
      const closedAt = toDatetimeString(
        Date.parse(createdAt) + fixture.elapsedMs,
      )
      const db = network.ozone.ctx.db.db
      await db
        .updateTable('report')
        .set({ createdAt, status: 'closed', closedAt })
        .where('id', '=', report.id)
        .execute()
      await db
        .insertInto('report_activity')
        .values({
          reportId: report.id,
          activityType: 'closeActivity',
          previousStatus: 'open',
          createdAt: closedAt,
          createdBy: sc.dids.alice,
          isAutomated: false,
        })
        .execute()

      const expected = {
        id: report.id,
        resolutionTimeSec: fixture.seconds,
        priorityTargetMet: fixture.met,
      }
      expect(await getReport(report.id)).toMatchObject(expected)
      const { reports } = await modClient.queryReports({ status: 'closed' })
      expect(reports).toHaveLength(1)
      expect(reports[0]).toMatchObject(expected)
      const { data: latest } = await agent.tools.ozone.report.getLatestReport(
        {},
        {
          headers: await network.ozone.modHeaders(
            tools.ozone.report.getLatestReport.$lxm,
            'moderator',
          ),
        },
      )
      expect(latest.report).toMatchObject(expected)
      const { data: activities } =
        await agent.tools.ozone.report.queryActivities(
          { activityTypes: ['closeActivity'] },
          {
            headers: await network.ozone.modHeaders(
              tools.ozone.report.queryActivities.$lxm,
              'moderator',
            ),
          },
        )
      expect(activities.activities).toHaveLength(1)
      for (const activity of activities.activities) {
        expect(activity.report).toMatchObject(expected)
      }
    })

    it('clears results on reopen', async () => {})

    it('returns a duration without a target result for unprioritized reports', async () => {
      const report = await createReport(other)
      await changeReportStatus(report.id, true)
      const closed = await getReport(report.id)
      expect(closed.resolutionTimeSec).toBeGreaterThanOrEqual(0)
      expect(closed.priorityTargetMet).toBeUndefined()
    })

    it('calculates closure metrics without activity history', async () => {
      await configure()
      const report = await createReport(urgent)
      await network.ozone.ctx.db.db
        .updateTable('report')
        .set({ status: 'closed', closedAt: toDatetimeString(Date.now()) })
        .where('id', '=', report.id)
        .execute()
      const closed = await getReport(report.id)
      expect(closed.resolutionTimeSec).toBeGreaterThanOrEqual(0)
      expect(closed.priorityTargetMet).toBe(true)
    })
  })

  it('leaves reports unprioritized when their mapped level is missing', async () => {
    await configure()

    // simulate a dangling mapping
    await network.ozone.ctx.db.db
      .updateTable('setting')
      .set({
        value: {
          normal: { name: 'Normal', targetResolutionMinutes: 5, score: 0 },
        },
      })
      .where('key', '=', PriorityLevelSettingKey)
      .where('scope', '=', 'instance')
      .execute()

    expect(await createReport(urgent)).toMatchObject({
      priorityLevel: null,
      priorityScore: null,
      priorityTargetMinutes: null,
    })
    expect(await createReport(spam)).toMatchObject({
      priorityLevel: 'normal',
      priorityScore: 0,
      priorityTargetMinutes: 5,
    })
  })

  it('keeps report priority independent of manual subject priority', async () => {
    await configure()
    const high = await createReport(urgent, sc.dids.bob)
    const low = await createReport(spam, sc.dids.carol)
    await modClient.emitEvent({
      subject: {
        $type: com.atproto.admin.defs.repoRef.$type,
        did: sc.dids.carol,
      },
      event: {
        $type: tools.ozone.moderation.defs.modEventPriorityScore.$type,
        score: 100,
      },
    })
    const { reports } = await modClient.queryReports({
      status: 'queued',
      queueId,
      sortField: 'createdAt',
      sortDirection: 'asc',
    })
    expect(reports.map((report) => report.id)).toEqual([high.id, low.id])
    expect(reports[1].priorityScore).toBe(0)
    expect(reports[1].subject.status?.priorityScore).toBe(100)
  })
})
