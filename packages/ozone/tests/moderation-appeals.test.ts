import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import AtpAgent, {
  ComAtprotoAdminDefs,
  ComAtprotoAdminEmitModerationEvent,
  ComAtprotoAdminQueryModerationStatuses,
} from '@atproto/api'
import {
  REASONMISLEADING,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'
import {
  REVIEWCLOSED,
  REVIEWOPEN,
} from '@atproto/api/src/client/types/com/atproto/admin/defs'
import { REASONAPPEAL } from '@atproto/api/src/client/types/com/atproto/moderation/defs'
import { REVIEWESCALATED } from '../src/lexicon/types/com/atproto/admin/defs'

describe('moderation-appeals', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  const emitModerationEvent = async (
    eventData: ComAtprotoAdminEmitModerationEvent.InputSchema,
  ) => {
    return pdsAgent.api.com.atproto.admin.emitModerationEvent(eventData, {
      encoding: 'application/json',
      headers: network.ozone.adminAuthHeaders('moderator'),
    })
  }

  const queryModerationStatuses = (
    statusQuery: ComAtprotoAdminQueryModerationStatuses.QueryParams,
  ) =>
    agent.api.com.atproto.admin.queryModerationStatuses(statusQuery, {
      headers: network.ozone.adminAuthHeaders('moderator'),
    })

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_moderation_appeals',
    })
    agent = network.ozone.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
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
  ): Promise<ComAtprotoAdminDefs.SubjectStatusView | undefined> => {
    const { data } = await queryModerationStatuses({
      subject,
    })
    expect(data.subjectStatuses[0]?.reviewState).toEqual(status)
    expect(data.subjectStatuses[0]?.appealed).toEqual(appealed)
    return data.subjectStatuses[0]
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
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONMISLEADING,
        },
        subject: getBobsPostSubject(),
        createdBy: sc.dids.alice,
      })

      await assertBobsPostStatus(REVIEWOPEN, undefined)

      // Create a report as normal user with appeal type
      expect(
        sc.createReport({
          reportedBy: sc.dids.carol,
          reasonType: REASONAPPEAL,
          reason: 'appealing',
          subject: getBobsPostSubject(),
        }),
      ).rejects.toThrow('You cannot appeal this report')

      // Verify that the appeal status did not change
      await assertBobsPostStatus(REVIEWOPEN, undefined)

      // Emit report event as moderator
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONAPPEAL,
        },
        subject: getBobsPostSubject(),
        createdBy: sc.dids.alice,
      })

      // Verify that appeal status changed when appeal report was emitted by moderator
      const status = await assertBobsPostStatus(REVIEWESCALATED, true)
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
        REVIEWOPEN,
        undefined,
      )

      await sc.createReport({
        reportedBy: sc.dids.carol,
        reasonType: REASONAPPEAL,
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
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventResolveAppeal',
        },
        subject: getBobsPostSubject(),
        createdBy: sc.dids.carol,
      })

      const previousStatus = await assertBobsPostStatus(REVIEWESCALATED, false)

      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONAPPEAL,
        },
        subject: getBobsPostSubject(),
        createdBy: sc.dids.bob,
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
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONMISLEADING,
        },
        subject: getAlicesPostSubject(),
        createdBy: sc.dids.bob,
      })

      // Moderator acknowledges the report, assume a label was applied too
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventAcknowledge',
        },
        subject: getAlicesPostSubject(),
        createdBy: sc.dids.carol,
      })

      // Alice appeals the report
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONAPPEAL,
        },
        subject: getAlicesPostSubject(),
        createdBy: sc.dids.alice,
      })

      await assertSubjectStatus(
        getAlicesPostSubject().uri,
        REVIEWESCALATED,
        true,
      )

      // Bob reports it again
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONSPAM,
        },
        subject: getAlicesPostSubject(),
        createdBy: sc.dids.bob,
      })

      // Assert that the status is still REVIEWESCALATED, as report events are meant to do
      await assertSubjectStatus(
        getAlicesPostSubject().uri,
        REVIEWESCALATED,
        true,
      )

      // Emit an escalation event
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventEscalate',
        },
        subject: getAlicesPostSubject(),
        createdBy: sc.dids.carol,
      })

      await assertSubjectStatus(
        getAlicesPostSubject().uri,
        REVIEWESCALATED,
        true,
      )

      // Emit an acknowledge event
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventAcknowledge',
        },
        subject: getAlicesPostSubject(),
        createdBy: sc.dids.carol,
      })

      // Assert that status moved on to reviewClosed while appealed status is still true
      await assertSubjectStatus(getAlicesPostSubject().uri, REVIEWCLOSED, true)

      // Emit a resolveAppeal event
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventResolveAppeal',
          comment: 'lgtm',
        },
        subject: getAlicesPostSubject(),
        createdBy: sc.dids.carol,
      })

      // Assert that status stayed the same while appealed status is still true
      await assertSubjectStatus(getAlicesPostSubject().uri, REVIEWCLOSED, false)
    })
  })
})
