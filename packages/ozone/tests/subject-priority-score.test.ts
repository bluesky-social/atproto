import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { REASONSPAM } from '../dist/lexicon/types/com/atproto/moderation/defs'

describe('moderation', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_priority_score',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await Promise.all([
      sc.createReport({
        reasonType: REASONSPAM,
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
        },
        reportedBy: sc.dids.carol,
      }),
      sc.createReport({
        reasonType: REASONSPAM,
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.alice,
        },
        reportedBy: sc.dids.carol,
      }),
      sc.createReport({
        reasonType: REASONSPAM,
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: sc.posts[sc.dids.bob][0].ref.uriStr,
          cid: sc.posts[sc.dids.bob][0].ref.cidStr,
        },
        reportedBy: sc.dids.carol,
      }),
    ])
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('allows setting a priority score.', async () => {
    const { subjectStatuses: before } = await modClient.queryStatuses({})
    await Promise.all([
      modClient.emitEvent({
        subject: before[before.length - 1].subject,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventPriorityScore',
          score: 10,
        },
      }),
      modClient.emitEvent({
        subject: before[before.length - 2].subject,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventPriorityScore',
          score: 5,
        },
      }),
    ])
    const { subjectStatuses: after } = await modClient.queryStatuses({
      sortDirection: 'desc',
      sortField: 'priorityScore',
    })

    // Verify that highest priority score item is first
    expect(after[0].priorityScore).toBe(10)
    expect(after[1].priorityScore).toBe(5)
    expect(after[0].subject).toMatchObject(before[before.length - 1].subject)
    expect(after[1].subject).toMatchObject(before[before.length - 2].subject)
  })

  it('allows setting a priority score.', async () => {
    const { subjectStatuses } = await modClient.queryStatuses({
      minPriorityScore: 6,
      sortDirection: 'desc',
      sortField: 'priorityScore',
    })

    // Verify that highest priority score item is first
    expect(subjectStatuses[0].priorityScore).toBe(10)
    expect(subjectStatuses.length).toBe(1)
  })
})
