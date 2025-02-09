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
import {
  REVIEWNONE,
  REVIEWOPEN,
} from '../src/lexicon/types/tools/ozone/moderation/defs'

describe('report-muting', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_muting',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  const assertSubjectStatus = async (
    subject: string,
    status?: string,
  ): Promise<ToolsOzoneModerationDefs.SubjectStatusView | undefined> => {
    const res = await modClient.queryStatuses({
      subject,
    })
    expect(res.subjectStatuses[0]?.reviewState).toEqual(status)
    return res.subjectStatuses[0]
  }

  it('does not change reviewState when muted reporter reports', async () => {
    const bobsPostSubject = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.bob][1].ref.uriStr,
      cid: sc.posts[sc.dids.bob][1].ref.cidStr,
    }
    const carolsAccountSubject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.carol,
    }

    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventMuteReporter',
        durationInHours: 24,
      },
      subject: carolsAccountSubject,
    })
    await sc.createReport({
      reportedBy: sc.dids.carol,
      reasonType: ComAtprotoModerationDefs.REASONMISLEADING,
      reason: 'misleading',
      subject: bobsPostSubject,
    })

    // Verify that a subject status was not created for bob's post since the reporter was muted
    await assertSubjectStatus(bobsPostSubject.uri, REVIEWNONE)
    // Verify, however, that the event was logged
    await modClient.queryEvents({
      subject: bobsPostSubject.uri,
    })

    // Verify that reporting mute duration is stored for the reporter
    const carolsStatus = await assertSubjectStatus(sc.dids.carol, REVIEWNONE)
    expect(
      new Date(`${carolsStatus?.muteReportingUntil}`).getTime(),
    ).toBeGreaterThan(Date.now())

    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventUnmuteReporter',
      },
      subject: carolsAccountSubject,
    })
    await sc.createReport({
      reportedBy: sc.dids.carol,
      reasonType: ComAtprotoModerationDefs.REASONMISLEADING,
      reason: 'misleading',
      subject: bobsPostSubject,
    })

    // Verify that a subject status was created for bob's post since the reporter was no longer muted
    await assertSubjectStatus(bobsPostSubject.uri, REVIEWOPEN)
  })
})
