import { jest } from '@jest/globals'
import { type CompiledQuery, sql } from 'kysely'
import {
  ComAtprotoModerationDefs,
  type ToolsOzoneModerationDefs,
} from '@atproto/api'
import { DAY } from '@atproto/common'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { toDatetimeString } from '@atproto/lex'
import { tools } from '../src/lexicons/index.js'

describe('reporter-stats', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_reporter_stats',
      ozone: { reporterStatsWindowDays: 30 },
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  const getReporterStats = async (
    did: string,
  ): Promise<ToolsOzoneModerationDefs.ReporterStats | undefined> => {
    const { stats } = await modClient.getReporterStats([did])
    return stats[0]
  }

  it('updates reporter stats based on actions', async () => {
    const bobsPostSubject1 = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.bob][0].ref.uriStr,
      cid: sc.posts[sc.dids.bob][0].ref.cidStr,
    }
    const bobsPostSubject2 = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.bob][1].ref.uriStr,
      cid: sc.posts[sc.dids.bob][1].ref.cidStr,
    }
    const carolsAccountSubject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.carol,
    }

    await Promise.all([
      sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: ComAtprotoModerationDefs.REASONMISLEADING,
        reason: 'misleading',
        subject: bobsPostSubject1,
      }),
      sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: ComAtprotoModerationDefs.REASONOTHER,
        reason: 'test',
        subject: bobsPostSubject1,
      }),
      sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: ComAtprotoModerationDefs.REASONOTHER,
        reason: 'test',
        subject: bobsPostSubject2,
      }),
      sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: ComAtprotoModerationDefs.REASONMISLEADING,
        reason: 'misleading',
        subject: carolsAccountSubject,
      }),
    ])

    await network.processAll()
    const statsAfterReport = await getReporterStats(sc.dids.alice)
    expect(statsAfterReport).toMatchObject({
      did: sc.dids.alice,
      accountReportCount: 1,
      recordReportCount: 3,
      reportedAccountCount: 1,
      reportedRecordCount: 2,
      takendownAccountCount: 0,
      takendownRecordCount: 0,
      labeledAccountCount: 0,
      labeledRecordCount: 0,
    })

    await Promise.all([
      modClient.emitEvent({
        subject: bobsPostSubject1,
        event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
        reportAction: { all: true },
      }),
      modClient.emitEvent({
        subject: bobsPostSubject2,
        event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
        reportAction: { all: true },
      }),
      modClient.emitEvent({
        subject: carolsAccountSubject,
        reportAction: { all: true },
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals: ['spam'],
          negateLabelVals: [],
        },
      }),
    ])

    await network.processAll()
    const statsAfterAction = await getReporterStats(sc.dids.alice)
    expect(statsAfterAction).toMatchObject({
      did: sc.dids.alice,
      accountReportCount: 1,
      recordReportCount: 3,
      reportedAccountCount: 1,
      reportedRecordCount: 2,
      takendownAccountCount: 0,
      takendownRecordCount: 2,
      labeledAccountCount: 1,
      labeledRecordCount: 0,
    })
  })

  async function createReporter(name: string) {
    const { did } = await sc.createAccount(name, {
      handle: `stats-${name}.test`,
      email: `${name}@test.com`,
      password: 'reporter-pass',
    })
    return did
  }

  it('counts linked actions once per subject and isolates reporters and record authors', async () => {
    const reporter = await createReporter('linked')
    const otherReporter = await createReporter('other')
    const subjects = [sc.dids.alice, sc.dids.dan].map((did) => ({
      $type: 'com.atproto.repo.strongRef',
      uri: `at://${did}/app.bsky.feed.post/same-rkey`,
      cid: sc.posts[did][0].ref.cidStr,
    }))
    const account = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.bob,
    }
    for (const subject of [...subjects, account]) {
      for (let i = 0; i < 2; i++) {
        await sc.createReport({
          subject,
          reportedBy: reporter,
          reasonType: ComAtprotoModerationDefs.REASONSPAM,
        })
      }
      await sc.createReport({
        subject,
        reportedBy: otherReporter,
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
      })
    }
    await network.processAll()

    for (const subject of subjects) {
      await modClient.emitEvent({
        subject,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals: ['spam'],
          negateLabelVals: [],
        },
        reportAction: { all: true },
      })
    }
    const takedown = await modClient.emitEvent({
      subject: account,
      event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
      reportAction: { all: true },
    })
    await modClient.reverseAction({ id: takedown.id, subject: account })
    await sc.createReport({
      subject: subjects[0],
      reportedBy: reporter,
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
    })
    await network.processAll()
    await modClient.emitEvent({
      subject: subjects[0],
      event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
      reportAction: { all: true },
    })

    const { stats } = await modClient.getReporterStats([
      reporter,
      otherReporter,
      reporter,
    ])
    expect(stats).toHaveLength(2)
    for (const [did, multiplier] of [
      [reporter, 2],
      [otherReporter, 1],
    ] as const) {
      expect(stats.find((entry) => entry.did === did)).toEqual({
        did,
        accountReportCount: multiplier,
        recordReportCount: 2 * multiplier + (did === reporter ? 1 : 0),
        reportedAccountCount: 1,
        reportedRecordCount: 2,
        takendownAccountCount: 1,
        takendownRecordCount: did === reporter ? 1 : 0,
        labeledAccountCount: 0,
        labeledRecordCount: 2,
      })
    }
  })

  it('does not credit unlinked enforcement or linked acknowledgements', async () => {
    const reporter = await createReporter('unlinked')
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.dan,
    }
    await sc.createReport({
      subject,
      reportedBy: reporter,
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
    })
    await network.processAll()
    await modClient.emitEvent({
      subject,
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['spam'],
        negateLabelVals: [],
      },
    })
    await modClient.emitEvent({
      subject,
      event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
    })
    await modClient.emitEvent({
      subject,
      event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
      reportAction: { all: true },
    })
    expect(await getReporterStats(reporter)).toMatchObject({
      accountReportCount: 1,
      reportedAccountCount: 1,
      takendownAccountCount: 0,
      labeledAccountCount: 0,
    })
  })

  it('uses the configured window inclusively and excludes old reports, their linked actions, and appeals', async () => {
    const reporter = await createReporter('window')
    const subjects = [sc.dids.alice, sc.dids.carol].map((did) => ({
      $type: 'com.atproto.admin.defs#repoRef',
      did,
    }))
    const reports: { id: number }[] = []
    for (const subject of subjects) {
      reports.push(
        await sc.createReport({
          subject,
          reportedBy: reporter,
          reasonType: ComAtprotoModerationDefs.REASONSPAM,
        }),
      )
    }
    await network.processAll()
    await modClient.emitEvent({
      subject: subjects[1],
      event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
      reportAction: { all: true },
    })
    await modClient.emitEvent({
      subject: subjects[0],
      createdBy: reporter,
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReport',
        reportType: tools.ozone.report.defs.ReasonAppeal,
      },
    })
    await network.processAll()

    const now = Date.now()
    const since = now - 30 * DAY
    const db = network.ozone.ctx.db.db
    // @NOTE Historical dates cannot be supplied through the report API.
    for (const [index, offset] of [0, -1].entries()) {
      await db
        .updateTable('report')
        .set({ createdAt: toDatetimeString(since + offset) })
        .where('eventId', '=', reports[index].id)
        .execute()
    }
    using _clock = jest.spyOn(Date, 'now').mockReturnValue(now)
    expect(await getReporterStats(reporter)).toEqual({
      did: reporter,
      accountReportCount: 1,
      recordReportCount: 0,
      reportedAccountCount: 1,
      reportedRecordCount: 0,
      takendownAccountCount: 0,
      takendownRecordCount: 0,
      labeledAccountCount: 0,
      labeledRecordCount: 0,
    })
    await db
      .updateTable('report')
      .set({ createdAt: toDatetimeString(since - 1) })
      .where('eventId', '=', reports[0].id)
      .execute()
    expect(await modClient.getReporterStats([reporter])).toEqual({ stats: [] })
  })

  it('uses reporter/time and event primary-key indexes without scanning subject history', async () => {
    const reporter = sc.dids.alice
    let query: CompiledQuery<unknown> | undefined
    {
      using queries = jest.spyOn(
        network.ozone.ctx.db.db.getExecutor(),
        'executeQuery',
      )
      await getReporterStats(reporter)
      query = queries.mock.calls
        .map(([compiled]) => compiled)
        .find((compiled) => compiled.sql.includes('linked_actions'))
    }
    if (!query) throw new Error('Reporter stats query not captured')
    const compiled = query
    type PlanNode = {
      'Relation Name'?: string
      'Index Name'?: string
      'Index Cond'?: string
      'Actual Rows': number
      'Actual Loops': number
      Plans?: PlanNode[]
    }
    const plan = await network.ozone.ctx.db.transaction(async (txn) => {
      // @NOTE Tiny fixtures favor sequential scans; prove the existing indexes
      // support the complete query and bound actual event lookup work.
      await sql`SET LOCAL enable_seqscan = off`.execute(txn.db)
      const { rows } = await txn.db.executeQuery<{
        'QUERY PLAN': { Plan: PlanNode }[]
      }>({
        ...compiled,
        sql: `EXPLAIN (ANALYZE, FORMAT JSON) ${compiled.sql}`,
      })
      return rows[0]['QUERY PLAN'][0].Plan
    })
    function nodes(node: PlanNode): PlanNode[] {
      return [node, ...(node.Plans ?? []).flatMap(nodes)]
    }
    const scans = nodes(plan)
    const reportScan = scans.find((node) => node['Relation Name'] === 'report')
    expect(reportScan?.['Index Name']).toBe('idx_report_reporter_created')
    expect(reportScan?.['Index Cond']).toContain('reporterDid')
    expect(reportScan?.['Index Cond']).toContain('createdAt')
    const eventScans = scans.filter(
      (node) => node['Relation Name'] === 'moderation_event',
    )
    expect(eventScans).toHaveLength(1)
    expect(eventScans[0]['Index Name']).toBe('moderation_event_pkey')
    expect(eventScans[0]['Actual Loops']).toBe(3)
    expect(eventScans[0]['Actual Rows']).toBeLessThanOrEqual(1)
  })

  it('omits reporters with no reports', async () => {
    expect(
      await modClient.getReporterStats(['did:plc:aaaaaaaaaaaaaaaaaaaaaaaa']),
    ).toEqual({ stats: [] })
  })
})
