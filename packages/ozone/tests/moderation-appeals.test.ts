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
  REASONMISLEADING,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'
import { REVIEWESCALATED } from '../src/lexicon/types/tools/ozone/moderation/defs'

describe('moderation-appeals', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_moderation_appeals',
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
    status: string,
    appealed: boolean | undefined,
  ): Promise<ToolsOzoneModerationDefs.SubjectStatusView | undefined> => {
    const res = await modClient.queryStatuses({
      subject,
    })
    expect(res.subjectStatuses[0]?.reviewState).toEqual(status)
    expect(res.subjectStatuses[0]?.appealed).toEqual(appealed)
    return res.subjectStatuses[0]
  }

  describe('appeals from users', () => {
    const getBobsPostSubject = () => ({
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.bob][1].ref.uriStr,
      cid: sc.posts[sc.dids.bob][1].ref.cidStr,
    })
    const getCarolPostSubject = () => ({
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.carol][0].ref.uriStr,
      cid: sc.posts[sc.dids.carol][0].ref.cidStr,
    })
    const assertBobsPostStatus = async (
      status: string,
      appealed: boolean | undefined,
    ) => assertSubjectStatus(getBobsPostSubject().uri, status, appealed)

    it('only changes subject status if original author of the content or a moderator is appealing', async () => {
      // Create a report by alice
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReport',
          reportType: REASONMISLEADING,
        },
        subject: getBobsPostSubject(),
      })

      await assertBobsPostStatus(ToolsOzoneModerationDefs.REVIEWOPEN, undefined)

      // Create a report as normal user with appeal type
      expect(
        sc.createReport({
          reportedBy: sc.dids.carol,
          reasonType: ComAtprotoModerationDefs.REASONAPPEAL,
          reason: 'appealing',
          subject: getBobsPostSubject(),
        }),
      ).rejects.toThrow('You cannot appeal this report')

      // Verify that the appeal status did not change
      await assertBobsPostStatus(ToolsOzoneModerationDefs.REVIEWOPEN, undefined)

      // Emit report event as moderator
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReport',
          reportType: ComAtprotoModerationDefs.REASONAPPEAL,
        },
        subject: getBobsPostSubject(),
      })

      // Verify that appeal status changed when appeal report was emitted by moderator
      const status = await assertBobsPostStatus(REVIEWESCALATED, true)
      // @ts-expect-error unspecced ?
      expect(status?.appealedAt).not.toBeNull()

      // Create a report as normal user for carol's post
      await sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: REASONMISLEADING,
        reason: 'lies!',
        subject: getCarolPostSubject(),
      })

      // Verify that the appeal status on carol's post is undefined
      await assertSubjectStatus(
        getCarolPostSubject().uri,
        ToolsOzoneModerationDefs.REVIEWOPEN,
        undefined,
      )

      await sc.createReport({
        reportedBy: sc.dids.carol,
        reasonType: ComAtprotoModerationDefs.REASONAPPEAL,
        reason: 'appealing',
        subject: getCarolPostSubject(),
      })
      // Verify that the appeal status on carol's post is true
      await assertSubjectStatus(
        getCarolPostSubject().uri,
        REVIEWESCALATED,
        true,
      )
    })
    it('allows multiple appeals and updates last appealed timestamp', async () => {
      // Resolve appeal with acknowledge
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventResolveAppeal',
        },
        subject: getBobsPostSubject(),
      })

      const previousStatus = await assertBobsPostStatus(REVIEWESCALATED, false)

      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReport',
          reportType: ComAtprotoModerationDefs.REASONAPPEAL,
        },
        subject: getBobsPostSubject(),
      })

      // Verify that even after the appeal event by bob for his post, the appeal status is true again with new timestamp
      const newStatus = await assertBobsPostStatus(REVIEWESCALATED, true)
      expect(
        new Date(`${previousStatus?.lastAppealedAt}`).getTime(),
      ).toBeLessThan(new Date(`${newStatus?.lastAppealedAt}`).getTime())
    })
  })

  describe('appeal resolution', () => {
    const getAlicesPostSubject = () => ({
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.alice][1].ref.uriStr,
      cid: sc.posts[sc.dids.alice][1].ref.cidStr,
    })
    it('appeal status is maintained while review state changes based on incoming events', async () => {
      // Bob reports alice's post
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReport',
          reportType: REASONMISLEADING,
        },
        subject: getAlicesPostSubject(),
      })

      // Moderator acknowledges the report, assume a label was applied too
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
        },
        subject: getAlicesPostSubject(),
      })

      // Alice appeals the report
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReport',
          reportType: ComAtprotoModerationDefs.REASONAPPEAL,
        },
        subject: getAlicesPostSubject(),
      })

      await assertSubjectStatus(
        getAlicesPostSubject().uri,
        REVIEWESCALATED,
        true,
      )

      // Bob reports it again
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReport',
          reportType: REASONSPAM,
        },
        subject: getAlicesPostSubject(),
      })

      // Assert that the status is still REVIEWESCALATED, as report events are meant to do
      await assertSubjectStatus(
        getAlicesPostSubject().uri,
        REVIEWESCALATED,
        true,
      )

      // Emit an escalation event
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventEscalate',
        },
        subject: getAlicesPostSubject(),
      })

      await assertSubjectStatus(
        getAlicesPostSubject().uri,
        REVIEWESCALATED,
        true,
      )

      // Emit an acknowledge event
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
        },
        subject: getAlicesPostSubject(),
      })

      // Assert that status moved on to reviewClosed while appealed status is still true
      await assertSubjectStatus(
        getAlicesPostSubject().uri,
        ToolsOzoneModerationDefs.REVIEWCLOSED,
        true,
      )

      // Emit a resolveAppeal event
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventResolveAppeal',
          comment: 'lgtm',
        },
        subject: getAlicesPostSubject(),
      })

      // Assert that status stayed the same while appealed status is still true
      await assertSubjectStatus(
        getAlicesPostSubject().uri,
        ToolsOzoneModerationDefs.REVIEWCLOSED,
        false,
      )
    })
  })
})
