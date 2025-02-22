import assert from 'node:assert'
import { ComAtprotoAdminDefs } from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
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

    it('allows filtering by tags', async () => {
      await modClient.emitEvent({
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.alice,
        },
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTag',
          add: ['report:spam', 'lang:ja', 'lang:en'],
          remove: [],
        },
      })
      const [englishAndJapaneseQueue, englishOrJapaneseQueue] =
        await Promise.all([
          modClient.queryStatuses({
            tags: ['lang:ja&&lang:en'],
          }),
          modClient.queryStatuses({
            tags: ['report:ja', 'lang:en'],
          }),
        ])

      // Verify that the queue only contains 1 item with both en and ja tags which is alice's account
      expect(englishAndJapaneseQueue.subjectStatuses.length).toEqual(1)
      const { subject } = englishAndJapaneseQueue.subjectStatuses[0]
      assert(ComAtprotoAdminDefs.isRepoRef(subject))
      expect(subject.did).toEqual(sc.dids.alice)

      // Verify that when querying for either en or ja tags, both alice and bob are returned
      expect(englishOrJapaneseQueue.subjectStatuses.length).toEqual(2)
      const englishOrJapaneseDids = englishOrJapaneseQueue.subjectStatuses.map(
        ({ subject }) => {
          assert(ComAtprotoAdminDefs.isRepoRef(subject))
          return subject.did
        },
      )
      expect(englishOrJapaneseDids).toContain(sc.dids.alice)
      expect(englishOrJapaneseDids).toContain(sc.dids.bob)
    })
  })
})
