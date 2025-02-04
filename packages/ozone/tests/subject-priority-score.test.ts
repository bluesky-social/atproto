import {
  TestNetwork,
  SeedClient,
  basicSeed,
  ModeratorClient,
} from '@atproto/dev-env'

describe('moderation', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  const repoSubject = (did: string) => ({
    $type: 'com.atproto.admin.defs#repoRef',
    did,
  })

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_takedown',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
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
})
