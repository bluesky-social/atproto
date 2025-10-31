import {
  ComAtprotoModerationDefs,
  ToolsOzoneModerationDefs,
} from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'

describe('reporter-stats', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_reporter_stats',
      ozone: {
        dbMaterializedViewRefreshIntervalMs: 1000,
      },
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
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
      modClient.performTakedown({
        subject: bobsPostSubject1,
        policies: ['trolling'],
      }),
      modClient.performTakedown({
        subject: bobsPostSubject2,
        policies: ['trolling'],
      }),
      modClient.emitEvent({
        subject: carolsAccountSubject,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals: ['spam'],
          negateLabelVals: [],
        },
      }),
    ])

    await network.processAll()
    await new Promise((resolve) => setTimeout(resolve, 1000))
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
})
