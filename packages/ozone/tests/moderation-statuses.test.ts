import {
  TestNetwork,
  SeedClient,
  basicSeed,
  ModeratorClient,
} from '@atproto/dev-env'
import {
  ComAtprotoAdminDefs,
  ComAtprotoAdminQueryModerationStatuses,
} from '@atproto/api'
import { forSnapshot } from './_util'
import {
  REASONMISLEADING,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'

describe('moderation-statuses', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  const seedEvents = async () => {
    const bobsAccount = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.bob,
    }
    const carlasAccount = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.alice,
    }
    const bobsPost = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.bob][1].ref.uriStr,
      cid: sc.posts[sc.dids.bob][1].ref.cidStr,
    }
    const alicesPost = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.alice][1].ref.uriStr,
      cid: sc.posts[sc.dids.alice][1].ref.cidStr,
    }

    for (let i = 0; i < 4; i++) {
      await modClient.emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: i % 2 ? REASONSPAM : REASONMISLEADING,
          comment: 'X',
        },
        //   Report bob's account by alice and vice versa
        subject: i % 2 ? bobsAccount : carlasAccount,
        createdBy: i % 2 ? sc.dids.alice : sc.dids.bob,
      })
      await modClient.emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONSPAM,
          comment: 'X',
        },
        //   Report bob's post by alice and vice versa
        subject: i % 2 ? bobsPost : alicesPost,
        createdBy: i % 2 ? sc.dids.alice : sc.dids.bob,
      })
    }
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_moderation_statuses',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
    await seedEvents()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('query statuses', () => {
    it('returns statuses for subjects that received moderation events', async () => {
      const response = await modClient.queryModerationStatuses({})

      expect(forSnapshot(response.subjectStatuses)).toMatchSnapshot()
    })

    it('returns paginated statuses', async () => {
      // We know there will be exactly 4 statuses in db
      const getPaginatedStatuses = async (
        params: ComAtprotoAdminQueryModerationStatuses.QueryParams,
      ) => {
        let cursor: string | undefined = ''
        const statuses: ComAtprotoAdminDefs.SubjectStatusView[] = []
        let count = 0
        do {
          const results = await modClient.queryModerationStatuses({
            limit: 1,
            cursor,
            ...params,
          })
          cursor = results.cursor
          statuses.push(...results.subjectStatuses)
          count++
          // The count is just a brake-check to prevent infinite loop
        } while (cursor && count < 10)

        return statuses
      }

      const list = await getPaginatedStatuses({})
      expect(list[0].id).toEqual(4)
      expect(list[list.length - 1].id).toEqual(1)

      await modClient.emitModerationEvent({
        subject: list[1].subject,
        event: {
          $type: 'com.atproto.admin.defs#modEventAcknowledge',
          comment: 'X',
        },
        createdBy: sc.dids.bob,
      })

      const listReviewedFirst = await getPaginatedStatuses({
        sortDirection: 'desc',
        sortField: 'lastReviewedAt',
      })

      // Verify that the item that was recently reviewed comes up first when sorted descendingly
      // while the result set always contains same number of items regardless of sorting
      expect(listReviewedFirst[0].id).toEqual(list[1].id)
      expect(listReviewedFirst.length).toEqual(list.length)
    })
  })
})
