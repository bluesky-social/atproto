import assert from 'node:assert'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import AtpAgent, {
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
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  const emitModerationEvent = async (eventData) => {
    return pdsAgent.api.com.atproto.admin.emitModerationEvent(eventData, {
      encoding: 'application/json',
      headers: network.ozone.adminAuthHeaders('moderator'),
    })
  }

  const queryModerationStatuses = (statusQuery) =>
    agent.api.com.atproto.admin.queryModerationStatuses(statusQuery, {
      headers: network.ozone.adminAuthHeaders('moderator'),
    })

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
      uri: sc.posts[sc.dids.bob][0].ref.uriStr,
      cid: sc.posts[sc.dids.bob][0].ref.cidStr,
    }
    const alicesPost = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.alice][1].ref.uriStr,
      cid: sc.posts[sc.dids.alice][1].ref.cidStr,
    }

    for (let i = 0; i < 4; i++) {
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: i % 2 ? REASONSPAM : REASONMISLEADING,
          comment: 'X',
        },
        //   Report bob's account by alice and vice versa
        subject: i % 2 ? bobsAccount : carlasAccount,
        createdBy: i % 2 ? sc.dids.alice : sc.dids.bob,
      })
      await emitModerationEvent({
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
    agent = network.ozone.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    await seedEvents()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('query statuses', () => {
    it('returns statuses for subjects that received moderation events', async () => {
      const response = await queryModerationStatuses({})

      expect(forSnapshot(response.data.subjectStatuses)).toMatchSnapshot()
    })

    it('returns statuses filtered by subject language', async () => {
      const klingonQueue = await queryModerationStatuses({
        tags: ['lang:i'],
      })

      expect(forSnapshot(klingonQueue.data.subjectStatuses)).toMatchSnapshot()

      const nonKlingonQueue = await queryModerationStatuses({
        excludeTags: ['lang:i'],
      })

      // Verify that the klingon tagged subject is not returned when excluding klingon
      expect(
        nonKlingonQueue.data.subjectStatuses.map((s) => s.id),
      ).not.toContain(klingonQueue.data.subjectStatuses[0].id)
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
          const results = await queryModerationStatuses({
            limit: 1,
            cursor,
            ...params,
          })
          cursor = results.data.cursor
          statuses.push(...results.data.subjectStatuses)
          count++
          // The count is just a brake-check to prevent infinite loop
        } while (cursor && count < 10)

        return statuses
      }

      const list = await getPaginatedStatuses({})
      expect(list[0].id).toEqual(7)
      expect(list[list.length - 1].id).toEqual(1)

      await emitModerationEvent({
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

  describe('blobs', () => {
    it('are tracked on takendown subject', async () => {
      const post = sc.posts[sc.dids.carol][0]
      assert(post.images.length > 1)
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventTakedown',
        },
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.ref.uriStr,
          cid: post.ref.cidStr,
        },
        subjectBlobCids: [post.images[0].image.ref.toString()],
        createdBy: sc.dids.alice,
      })
      const { data: result } =
        await pdsAgent.api.com.atproto.admin.queryModerationStatuses(
          { subject: post.ref.uriStr },
          { headers: network.ozone.adminAuthHeaders('moderator') },
        )
      expect(result.subjectStatuses.length).toBe(1)
      expect(result.subjectStatuses[0]).toMatchObject({
        takendown: true,
        subjectBlobCids: [post.images[0].image.ref.toString()],
      })
    })

    it('are tracked on reverse-takendown subject based on previous status', async () => {
      const post = sc.posts[sc.dids.carol][0]
      await emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReverseTakedown',
        },
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.ref.uriStr,
          cid: post.ref.cidStr,
        },
        createdBy: sc.dids.alice,
      })
      const { data: result } =
        await pdsAgent.api.com.atproto.admin.queryModerationStatuses(
          { subject: post.ref.uriStr },
          { headers: network.ozone.adminAuthHeaders('moderator') },
        )
      expect(result.subjectStatuses.length).toBe(1)
      expect(result.subjectStatuses[0]).toMatchObject({
        takendown: false,
        subjectBlobCids: [post.images[0].image.ref.toString()],
      })
    })
  })
})
