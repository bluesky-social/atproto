import { type AtpAgent, ids } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import type { DidString } from '@atproto/lex'
import { APPEAL_REASON_TYPE } from '../src/inbox/appeal.js'
import { com, tools } from '../src/lexicons/index.js'
import {
  PriorityLevelSettingKey,
  ReportPriorityLevelSettingKey,
} from '../src/setting/constants.js'

const spam = com.atproto.moderation.defs.ReasonSpam
const other = com.atproto.moderation.defs.ReasonOther
const urgent = tools.ozone.report.defs.ReasonViolenceThreats
const levels = {
  urgent: { name: 'Urgent', targetResolutionMinutes: 720, score: 100 },
  normal: { name: 'Normal', targetResolutionMinutes: 1440, score: 0 },
}

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
    await upsertSetting(PriorityLevelSettingKey, levels)
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

  it('preserves configured and unconfigured snapshots through config changes and rerouting', async () => {
    const legacy = await createReport(urgent)
    await configure()
    const original = await createReport(urgent)
    await upsertSetting(PriorityLevelSettingKey, {
      ...levels,
      urgent: { name: 'Changed', targetResolutionMinutes: 1440, score: 25 },
    })
    await upsertSetting(ReportPriorityLevelSettingKey, { [urgent]: 'normal' })
    const latest = await createReport(urgent)
    const db = network.ozone.ctx.db.db
    await db
      .updateTable('report')
      .set({ queueId: -1, status: 'open' })
      .execute()
    await agent.tools.ozone.queue.routeReports(
      { startReportId: legacy.id, endReportId: latest.id },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneQueueRouteReports,
          'admin',
        ),
      },
    )
    const { reports } = await modClient.queryReports({
      status: 'queued',
      queueId,
      sortField: 'createdAt',
      sortDirection: 'asc',
    })
    expect(
      reports.map(
        ({ priorityLevel, priorityScore, priorityTargetMinutes }) => ({
          priorityLevel,
          priorityScore,
          priorityTargetMinutes,
        }),
      ),
    ).toEqual([
      {
        priorityLevel: undefined,
        priorityScore: undefined,
        priorityTargetMinutes: undefined,
      },
      {
        priorityLevel: 'urgent',
        priorityScore: 100,
        priorityTargetMinutes: 720,
      },
      {
        priorityLevel: 'normal',
        priorityScore: 0,
        priorityTargetMinutes: 1440,
      },
    ])
    const { data } = await agent.tools.ozone.report.getReport(
      { id: original.id },
      {
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneReportGetReport,
          'moderator',
        ),
      },
    )
    expect(data).toMatchObject({
      priorityLevel: 'urgent',
      priorityScore: 100,
      priorityTargetMinutes: 720,
    })
  })

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
    await upsertSetting(PriorityLevelSettingKey, levels)
    expect(await createReport(urgent)).toMatchObject({
      priorityLevel: null,
      priorityScore: null,
      priorityTargetMinutes: null,
    })
  })

  it('leaves reports unprioritized when their mapped level is missing', async () => {
    await configure()
    // @NOTE Simulate a dangling mapping left by overlapping settings writes.
    await network.ozone.ctx.db.db
      .updateTable('setting')
      .set({ value: { normal: levels.normal } })
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
      priorityTargetMinutes: 1440,
    })
  })

  it.each([false, true])(
    'snapshots immediately routed appeals and preserves them during daemon replay (configured %s)',
    async (configured) => {
      if (configured) {
        await upsertSetting(PriorityLevelSettingKey, levels)
        await upsertSetting(ReportPriorityLevelSettingKey, {
          [APPEAL_REASON_TYPE]: 'urgent',
        })
      }
      const subject = {
        $type: com.atproto.admin.defs.repoRef.$type,
        did: sc.dids.bob,
      }
      const action = await modClient.emitEvent({
        subject,
        event: {
          $type: tools.ozone.moderation.defs.modEventLabel.$type,
          createLabelVals: ['!warn'],
          negateLabelVals: [],
        },
      })
      await agent.tools.ozone.inbox.appealActionedSubject(
        {
          subject,
          action: {
            $type: tools.ozone.inbox.appealActionedSubject.actionRef.$type,
            id: action.id,
          },
          reason: 'Please reconsider this decision',
        },
        {
          encoding: 'application/json',
          headers: await network.ozone.modHeaders(
            tools.ozone.inbox.appealActionedSubject.$lxm,
            'moderator',
          ),
        },
      )
      const db = network.ozone.ctx.db
      const report = await db.db
        .selectFrom('report')
        .selectAll()
        .where('reportType', '=', APPEAL_REASON_TYPE)
        .where('did', '=', sc.dids.bob)
        .executeTakeFirstOrThrow()
      const snapshot = configured
        ? {
            priorityLevel: 'urgent',
            priorityScore: 100,
            priorityTargetMinutes: 720,
          }
        : {
            priorityLevel: null,
            priorityScore: null,
            priorityTargetMinutes: null,
          }
      expect(report).toMatchObject(snapshot)

      await upsertSetting(PriorityLevelSettingKey, levels)
      await upsertSetting(ReportPriorityLevelSettingKey, {
        [APPEAL_REASON_TYPE]: 'normal',
      })
      await network.ozone.ctx.queueService(db).insertReportsFromEvents({
        cursor: report.eventId - 1,
        limit: 1,
      })
      const reports = await db.db
        .selectFrom('report')
        .selectAll()
        .where('eventId', '=', report.eventId)
        .execute()
      expect(reports).toHaveLength(1)
      expect(reports[0]).toMatchObject({ id: report.id, ...snapshot })
    },
  )

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
