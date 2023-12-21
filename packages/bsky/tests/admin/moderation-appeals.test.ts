import { TestNetwork, SeedClient } from '@atproto/dev-env'
import AtpAgent, {
  ComAtprotoAdminDefs,
  ComAtprotoAdminEmitModerationEvent,
  ComAtprotoAdminQueryModerationStatuses,
} from '@atproto/api'
import { forSnapshot } from '../_util'
import basicSeed from '../seeds/basic'
import {
  REASONMISLEADING,
  REASONSPAM,
} from '../../src/lexicon/types/com/atproto/moderation/defs'
import {
  REVIEWCLOSED,
  REVIEWOPEN,
} from '@atproto/api/src/client/types/com/atproto/admin/defs'
import { REASONAPPEAL } from '@atproto/api/src/client/types/com/atproto/moderation/defs'
import { REVIEWESCALATED } from '../../src/lexicon/types/com/atproto/admin/defs'

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
      headers: network.bsky.adminAuthHeaders('moderator'),
    })
  }

  const queryModerationStatuses = (
    statusQuery: ComAtprotoAdminQueryModerationStatuses.QueryParams,
  ) =>
    agent.api.com.atproto.admin.queryModerationStatuses(statusQuery, {
      headers: network.bsky.adminAuthHeaders('moderator'),
    })

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_moderation_statuses',
    })
    agent = network.bsky.getClient()
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
    const assertBobsPostStatus = async (
      status: string,
      appealed: boolean | undefined,
    ) => assertSubjectStatus(getBobsPostSubject().uri, status, appealed)

    it('only changes subject status if original author of the content is appealing', async () => {
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

      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONAPPEAL,
        },
        subject: getBobsPostSubject(),
        createdBy: sc.dids.alice,
      })

      // Verify that since the appeal was emitted by alice instead of bob, the status is still REVIEWOPEN
      await assertBobsPostStatus(REVIEWOPEN, undefined)

      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONAPPEAL,
        },
        subject: getBobsPostSubject(),
        createdBy: sc.dids.bob,
      })

      // Verify that since the appeal was emitted by bob, the appealed state has been set to true
      const status = await assertBobsPostStatus(REVIEWOPEN, true)
      expect(status?.appealedAt).not.toBeNull()
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

      const previousStatus = await assertBobsPostStatus(REVIEWOPEN, false)

      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONAPPEAL,
        },
        subject: getBobsPostSubject(),
        createdBy: sc.dids.bob,
      })

      // Verify that even after the appeal event by bob for his post, the appeal status is true again with new timestamp
      const newStatus = await assertBobsPostStatus(REVIEWOPEN, true)
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

      await assertSubjectStatus(getAlicesPostSubject().uri, REVIEWOPEN, true)

      // Bob reports it again
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONSPAM,
        },
        subject: getAlicesPostSubject(),
        createdBy: sc.dids.bob,
      })

      // Assert that the status is still REVIEWOPEN, as report events are meant to do
      await assertSubjectStatus(getAlicesPostSubject().uri, REVIEWOPEN, true)

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
