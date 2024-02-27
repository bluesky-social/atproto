import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { REASONSPAM } from '../src/lexicon/types/com/atproto/moderation/defs'

describe('moderation-status-tags', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  const emitModerationEvent = async (eventData) => {
    return pdsAgent.api.com.atproto.admin.emitModerationEvent(eventData, {
      encoding: 'application/json',
      headers: network.bsky.adminAuthHeaders('moderator'),
    })
  }

  const queryModerationStatuses = (statusQuery) =>
    agent.api.com.atproto.admin.queryModerationStatuses(statusQuery, {
      headers: network.bsky.adminAuthHeaders('moderator'),
    })

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_moderation_status_tags',
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

  describe('manage tags on subject status', () => {
    it('adds and removes tags on a subject', async () => {
      const bobsAccount = {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.bob,
      }
      await emitModerationEvent({
        subject: bobsAccount,
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          comment: 'X',
          reportType: REASONSPAM,
        },
        createdBy: sc.dids.alice,
      })
      await emitModerationEvent({
        subject: bobsAccount,
        event: {
          $type: 'com.atproto.admin.defs#modEventTag',
          add: ['interaction-churn'],
          remove: [],
        },
        createdBy: sc.dids.alice,
      })
      const { data: statusAfterInteractionTag } = await queryModerationStatuses(
        {
          subject: bobsAccount.did,
        },
      )
      expect(statusAfterInteractionTag.subjectStatuses[0].tags).toContain(
        'interaction-churn',
      )

      await emitModerationEvent({
        subject: bobsAccount,
        event: {
          $type: 'com.atproto.admin.defs#modEventTag',
          remove: ['interaction-churn'],
          add: ['follow-churn'],
        },
        createdBy: sc.dids.alice,
      })
      const { data: statusAfterFollowTag } = await queryModerationStatuses({
        subject: bobsAccount.did,
      })

      expect(statusAfterFollowTag.subjectStatuses[0].tags).not.toContain(
        'interaction-churn',
      )
      expect(statusAfterFollowTag.subjectStatuses[0].tags).toContain(
        'follow-churn',
      )
    })
  })
})
