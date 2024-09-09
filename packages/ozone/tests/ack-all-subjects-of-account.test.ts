import {
  TestNetwork,
  RecordRef,
  SeedClient,
  basicSeed,
  ModeratorClient,
} from '@atproto/dev-env'
import {
  REASONAPPEAL,
  REASONOTHER,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'
import {
  REVIEWCLOSED,
  REVIEWESCALATED,
  REVIEWOPEN,
  SubjectStatusView,
} from '../src/lexicon/types/tools/ozone/moderation/defs'
import { isRepoRef } from '../src/lexicon/types/com/atproto/admin/defs'
import { ComAtprotoRepoStrongRef } from '@atproto/api'

describe('moderation', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  const repoSubject = (did: string) => ({
    $type: 'com.atproto.admin.defs#repoRef',
    did,
  })

  const recordSubject = (ref: RecordRef) => ({
    $type: 'com.atproto.repo.strongRef',
    uri: ref.uriStr,
    cid: ref.cidStr,
  })

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_ack_all_subjects_of_account',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('acknowledges all open/escalated review subjects.', async () => {
    const postOne = sc.posts[sc.dids.bob][0].ref
    const postTwo = sc.posts[sc.dids.bob][1].ref
    await Promise.all([
      sc.createReport({
        reasonType: REASONSPAM,
        subject: repoSubject(sc.dids.bob),
        reportedBy: sc.dids.alice,
      }),
      sc.createReport({
        reasonType: REASONOTHER,
        reason: 'defamation',
        subject: recordSubject(postOne),
        reportedBy: sc.dids.carol,
      }),
      sc.createReport({
        reasonType: REASONOTHER,
        reason: 'defamation',
        subject: recordSubject(postTwo),
        reportedBy: sc.dids.carol,
      }),
    ])

    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReport',
        reportType: REASONAPPEAL,
      },
      subject: recordSubject(postTwo),
    })

    const { subjectStatuses: statusesBefore } = await modClient.queryStatuses({
      subject: sc.dids.bob,
      includeAllUserRecords: true,
    })

    await modClient.performTakedown({
      subject: repoSubject(sc.dids.bob),
      acknowledgeAccountSubjects: true,
    })

    const { subjectStatuses: statusesAfter } = await modClient.queryStatuses({
      subject: sc.dids.bob,
      includeAllUserRecords: true,
    })

    const getReviewStateBySubject = (subjects: SubjectStatusView[]) => {
      const states = new Map<string, SubjectStatusView>()

      subjects.forEach((item) => {
        if (ComAtprotoRepoStrongRef.isMain(item.subject)) {
          states.set(item.subject.uri, item)
        } else if (isRepoRef(item.subject)) {
          states.set(item.subject.did, item)
        }
      })

      return states
    }

    const reviewStatesBefore = getReviewStateBySubject(statusesBefore)
    const reviewStatesAfter = getReviewStateBySubject(statusesAfter)

    // Check that review states before were different for different subjects
    expect(reviewStatesBefore.get(postOne.uriStr)?.reviewState).toBe(REVIEWOPEN)
    expect(reviewStatesBefore.get(postTwo.uriStr)?.reviewState).toBe(
      REVIEWESCALATED,
    )
    expect(reviewStatesBefore.get(sc.dids.bob)?.reviewState).toBe(REVIEWOPEN)

    // Check that review states after are all closed
    expect(reviewStatesAfter.get(postOne.uriStr)?.reviewState).toBe(
      REVIEWCLOSED,
    )
    expect(reviewStatesAfter.get(postTwo.uriStr)?.reviewState).toBe(
      REVIEWCLOSED,
    )
    expect(reviewStatesAfter.get(sc.dids.bob)?.reviewState).toBe(REVIEWCLOSED)
  })
})
