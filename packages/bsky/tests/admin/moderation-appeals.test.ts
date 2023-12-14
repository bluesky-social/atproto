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
  REVIEWAPPEALED,
  REVIEWCLOSED,
  REVIEWOPEN,
} from '@atproto/api/src/client/types/com/atproto/admin/defs'
import { REASONAPPEAL } from '@atproto/api/src/client/types/com/atproto/moderation/defs'

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
  ): Promise<ComAtprotoAdminDefs.SubjectStatusView | undefined> => {
    const { data } = await queryModerationStatuses({
      subject,
    })
    expect(data.subjectStatuses[0]?.reviewState).toEqual(status)
    return data.subjectStatuses[0]
  }
  describe('appeals from users', () => {
    const getBobsPostSubject = () => ({
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.bob][1].ref.uriStr,
      cid: sc.posts[sc.dids.bob][1].ref.cidStr,
    })
    const assertBobsPostStatus = async (status: string) =>
      assertSubjectStatus(getBobsPostSubject().uri, status)

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

      await assertBobsPostStatus(REVIEWOPEN)

      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONAPPEAL,
        },
        subject: getBobsPostSubject(),
        createdBy: sc.dids.alice,
      })

      // Verify that since the appeal was emitted by alice instead of bob, the status is still REVIEWOPEN
      await assertBobsPostStatus(REVIEWOPEN)

      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONAPPEAL,
        },
        subject: getBobsPostSubject(),
        createdBy: sc.dids.bob,
      })

      // Verify that since the appeal was emitted by alice instead of bob, the status is still REVIEWOPEN
      const status = await assertBobsPostStatus(REVIEWAPPEALED)
      expect(status?.appealedAt).not.toBeNull()
    })
    it('does not change status to appealed if an appeal was already received', async () => {
      // Resolve appeal with acknowledge
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventAcknowledge',
        },
        subject: getBobsPostSubject(),
        createdBy: sc.dids.carol,
      })

      await assertBobsPostStatus(REVIEWCLOSED)

      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONAPPEAL,
        },
        subject: getBobsPostSubject(),
        createdBy: sc.dids.bob,
      })

      // Verify that even after the appeal event by bob for his post, the status is still REVIEWCLOSED
      await assertBobsPostStatus(REVIEWCLOSED)
    })
  })

  describe('appeal resolution', () => {
    const getAlicesPostSubject = () => ({
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.alice][1].ref.uriStr,
      cid: sc.posts[sc.dids.alice][1].ref.cidStr,
    })
    it('only allows changing appealed status to closed', async () => {
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

      await assertSubjectStatus(getAlicesPostSubject().uri, REVIEWAPPEALED)

      // Another bob reports it again
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONSPAM,
        },
        subject: getAlicesPostSubject(),
        createdBy: sc.dids.bob,
      })

      // Assert that the status is still REVIEWAPPEALED and not REVIEWOPEN, as report events are meant to do
      await assertSubjectStatus(getAlicesPostSubject().uri, REVIEWAPPEALED)

      // Emit an escalation event
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventEscalate',
        },
        subject: getAlicesPostSubject(),
        createdBy: sc.dids.carol,
      })

      await assertSubjectStatus(getAlicesPostSubject().uri, REVIEWAPPEALED)

      // Emit an acknowledge event
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventAcknowledge',
        },
        subject: getAlicesPostSubject(),
        createdBy: sc.dids.carol,
      })

      // Assert that status moved on to reviewClosed
      await assertSubjectStatus(getAlicesPostSubject().uri, REVIEWCLOSED)
    })
  })
})
