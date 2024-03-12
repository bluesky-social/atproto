import {
  TestNetwork,
  SeedClient,
  basicSeed,
  ModeratorClient,
} from '@atproto/dev-env'
import { REASONSPAM } from '../src/lexicon/types/com/atproto/moderation/defs'

describe('moderation-status-tags', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_moderation_status_tags',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
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
      await sc.createReport({
        reasonType: REASONSPAM,
        reason: 'X',
        subject: bobsAccount,
        reportedBy: sc.dids.alice,
      })
      await modClient.emitEvent({
        subject: bobsAccount,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTag',
          add: ['interaction-churn'],
          remove: [],
        },
      })
      const statusAfterInteractionTag = await modClient.queryStatuses({
        subject: bobsAccount.did,
      })
      expect(statusAfterInteractionTag.subjectStatuses[0].tags).toContain(
        'interaction-churn',
      )

      await modClient.emitEvent({
        subject: bobsAccount,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTag',
          remove: ['interaction-churn'],
          add: ['follow-churn'],
        },
      })
      const statusAfterFollowTag = await modClient.queryStatuses({
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
