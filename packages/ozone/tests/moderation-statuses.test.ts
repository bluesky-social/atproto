import assert from 'node:assert'
import {
  TestNetwork,
  SeedClient,
  basicSeed,
  ModeratorClient,
} from '@atproto/dev-env'
import {
  ToolsOzoneModerationDefs,
  ToolsOzoneModerationQueryStatuses,
} from '@atproto/api'
import { forSnapshot } from './_util'
import {
  REASONMISLEADING,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'
import {
  REVIEWOPEN,
  REVIEWNONE,
} from '../src/lexicon/types/tools/ozone/moderation/defs'

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
      uri: sc.posts[sc.dids.bob][0].ref.uriStr,
      cid: sc.posts[sc.dids.bob][0].ref.cidStr,
    }
    const alicesPost = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.alice][1].ref.uriStr,
      cid: sc.posts[sc.dids.alice][1].ref.cidStr,
    }

    for (let i = 0; i < 4; i++) {
      await sc.createReport({
        reasonType: i % 2 ? REASONSPAM : REASONMISLEADING,
        reason: 'X',
        //   Report bob's account by alice and vice versa
        subject: i % 2 ? bobsAccount : carlasAccount,
        reportedBy: i % 2 ? sc.dids.alice : sc.dids.bob,
      })
      await sc.createReport({
        reasonType: REASONSPAM,
        reason: 'X',
        //   Report bob's post by alice and vice versa
        subject: i % 2 ? bobsPost : alicesPost,
        reportedBy: i % 2 ? sc.dids.alice : sc.dids.bob,
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
      const response = await modClient.queryStatuses({})

      expect(forSnapshot(response.subjectStatuses)).toMatchSnapshot()
    })

    it('returns statuses filtered by subject language', async () => {
      const klingonQueue = await modClient.queryStatuses({
        tags: ['lang:i'],
      })

      expect(forSnapshot(klingonQueue.subjectStatuses)).toMatchSnapshot()

      const nonKlingonQueue = await modClient.queryStatuses({
        excludeTags: ['lang:i'],
      })

      // Verify that the klingon tagged subject is not returned when excluding klingon
      expect(nonKlingonQueue.subjectStatuses.map((s) => s.id)).not.toContain(
        klingonQueue.subjectStatuses[0].id,
      )

      // Verify multi lang tag exclusion
      Promise.all(
        nonKlingonQueue.subjectStatuses.map((s, i) => {
          return modClient.emitEvent({
            subject: s.subject,
            event: {
              $type: 'tools.ozone.moderation.defs#modEventTag',
              add: [i % 2 ? 'lang:jp' : 'lang:it'],
              remove: [],
              comment: 'Adding custom lang tag',
            },
            createdBy: sc.dids.alice,
          })
        }),
      )

      const queueWithoutKlingonAndItalian = await modClient.queryStatuses({
        excludeTags: ['lang:i', 'lang:it'],
      })

      queueWithoutKlingonAndItalian.subjectStatuses
        .map((s) => s.tags)
        .flat()
        .forEach((tag) => {
          expect(['lang:it', 'lang:i']).not.toContain(tag)
        })
    })

    it('returns paginated statuses', async () => {
      // We know there will be exactly 4 statuses in db
      const getPaginatedStatuses = async (
        params: ToolsOzoneModerationQueryStatuses.QueryParams,
      ) => {
        let cursor: string | undefined = ''
        const statuses: ToolsOzoneModerationDefs.SubjectStatusView[] = []
        let count = 0
        do {
          const results = await modClient.queryStatuses({
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
      expect(list[0].id).toEqual(7)
      expect(list[list.length - 1].id).toEqual(1)

      await modClient.emitEvent({
        subject: list[1].subject,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
          comment: 'X',
        },
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

    it('returns statuses for specified collections', async () => {
      const sp = await sc.createStarterPack(
        sc.dids.alice,
        "alice's about to get blocked starter pack",
        [sc.dids.bob, sc.dids.carol],
        [],
      )
      await sc.createReport({
        reasonType: REASONSPAM,
        reason: 'X',
        subject: {
          $type: 'com.atproto.repo.strongRef',
          ...sp.raw,
        },
        reportedBy: sc.dids.bob,
      })

      const [
        onlyStarterPackStatuses,
        onlyAlicesStarterPackStatuses,
        onlyBobsStarterPackStatuses,
        onlyPostStatuses,
      ] = await Promise.all([
        modClient.queryStatuses({
          collections: ['app.bsky.graph.starterpack'],
        }),
        modClient.queryStatuses({
          subject: sc.dids.alice,
          includeAllUserRecords: true,
          collections: ['app.bsky.graph.starterpack'],
        }),
        modClient.queryStatuses({
          subject: sc.dids.bob,
          includeAllUserRecords: true,
          collections: ['app.bsky.graph.starterpack'],
        }),
        modClient.queryStatuses({
          collections: ['app.bsky.feed.post'],
        }),
      ])

      expect(onlyStarterPackStatuses.subjectStatuses.length).toEqual(1)
      expect(onlyStarterPackStatuses.subjectStatuses[0].subject.uri).toContain(
        'app.bsky.graph.starterpack',
      )
      expect(onlyAlicesStarterPackStatuses.subjectStatuses.length).toEqual(1)
      expect(
        onlyAlicesStarterPackStatuses.subjectStatuses[0].subject.uri,
      ).toEqual(sp.uriStr)
      expect(onlyBobsStarterPackStatuses.subjectStatuses.length).toEqual(0)
      expect(onlyPostStatuses.subjectStatuses.length).toEqual(2)
    })

    it('returns statuses for account or records', async () => {
      const [
        onlyAccountStatuses,
        onlyRecordStatuses,
        onlyStatusesOnBobsAccount,
      ] = await Promise.all([
        modClient.queryStatuses({
          subjectType: 'account',
        }),
        modClient.queryStatuses({
          subjectType: 'record',
        }),
        modClient.queryStatuses({
          subject: sc.dids.bob,
          subjectType: 'record',
        }),
      ])

      // only account statuses are returned, no event has a uri
      expect(
        onlyAccountStatuses.subjectStatuses.every((e) => !e.subject.uri),
      ).toBeTruthy()

      // only record statuses are returned, all events have a uri
      expect(
        onlyRecordStatuses.subjectStatuses.every((e) => e.subject.uri),
      ).toBeTruthy()

      // only bob's account statuses are returned, no events have a URI even though the subjectType is record
      expect(
        onlyStatusesOnBobsAccount.subjectStatuses.every(
          (e) => !e.subject.uri && e.subject.did === sc.dids.bob,
        ),
      ).toBeTruthy()
    })
  })

  describe('reviewState changes', () => {
    it('only sets state to #reviewNone on first non-impactful event', async () => {
      const bobsAccount = {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.bob,
      }
      const alicesPost = {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      }
      const getBobsAccountStatus = async () => {
        const data = await modClient.queryStatuses({
          subject: bobsAccount.did,
        })

        return data.subjectStatuses[0]
      }
      // Since bob's account already had a reviewState, it won't be changed by non-impactful events
      const bobsAccountStatusBeforeTag = await getBobsAccountStatus()

      await Promise.all([
        modClient.emitEvent({
          subject: bobsAccount,
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTag',
            add: ['newTag'],
            remove: [],
            comment: 'X',
          },
          createdBy: sc.dids.alice,
        }),
        modClient.emitEvent({
          subject: bobsAccount,
          event: {
            $type: 'tools.ozone.moderation.defs#modEventComment',
            comment: 'X',
          },
          createdBy: sc.dids.alice,
        }),
      ])
      const bobsAccountStatusAfterTag = await getBobsAccountStatus()

      expect(bobsAccountStatusBeforeTag.reviewState).toEqual(
        bobsAccountStatusAfterTag.reviewState,
      )

      // Since alice's post didn't have a reviewState it is set to reviewNone on first non-impactful event
      const getAlicesPostStatus = async () => {
        const data = await modClient.queryStatuses({
          subject: alicesPost.uri,
        })

        return data.subjectStatuses[0]
      }

      const alicesPostStatusBeforeTag = await getAlicesPostStatus()
      expect(alicesPostStatusBeforeTag).toBeUndefined()

      await modClient.emitEvent({
        subject: alicesPost,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventComment',
          comment: 'X',
        },
        createdBy: sc.dids.alice,
      })
      const alicesPostStatusAfterTag = await getAlicesPostStatus()
      expect(alicesPostStatusAfterTag.reviewState).toEqual(REVIEWNONE)

      await modClient.emitEvent({
        subject: alicesPost,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReport',
          reportType: REASONMISLEADING,
          comment: 'X',
        },
        createdBy: sc.dids.alice,
      })
      const alicesPostStatusAfterReport = await getAlicesPostStatus()
      expect(alicesPostStatusAfterReport.reviewState).toEqual(REVIEWOPEN)
    })
  })

  describe('blobs', () => {
    it('are tracked on takendown subject', async () => {
      const post = sc.posts[sc.dids.carol][0]
      assert(post.images.length > 1)
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTakedown',
        },
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.ref.uriStr,
          cid: post.ref.cidStr,
        },
        subjectBlobCids: [post.images[0].image.ref.toString()],
        createdBy: sc.dids.alice,
      })
      const result = await modClient.queryStatuses({
        subject: post.ref.uriStr,
      })
      expect(result.subjectStatuses.length).toBe(1)
      expect(result.subjectStatuses[0]).toMatchObject({
        takendown: true,
        subjectBlobCids: [post.images[0].image.ref.toString()],
      })
    })

    it('are tracked on reverse-takendown subject based on previous status', async () => {
      const post = sc.posts[sc.dids.carol][0]
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
        },
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.ref.uriStr,
          cid: post.ref.cidStr,
        },
      })
      const result = await modClient.queryStatuses({
        subject: post.ref.uriStr,
      })
      expect(result.subjectStatuses.length).toBe(1)
      expect(result.subjectStatuses[0]).toMatchObject({
        takendown: false,
        subjectBlobCids: [post.images[0].image.ref.toString()],
      })
    })
  })
})
