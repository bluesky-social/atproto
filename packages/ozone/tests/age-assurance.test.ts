import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'

describe('age assurance events', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_age_assurance',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('sets age assurance state to pending for a subject', async () => {
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.alice,
    }

    await modClient.emitEvent({
      subject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceEvent',
        source: 'user',
        status: 'pending',
        comment: 'Age verification requested',
        attemptId: 'attempt-123',
      },
    })

    const { subjectStatuses } = await modClient.queryStatuses({
      subject: sc.dids.alice,
    })

    expect(subjectStatuses[0].ageAssuranceState).toBe('pending')
  })

  it('updates age assurance state from pending to unknown', async () => {
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.bob,
    }

    await modClient.emitEvent({
      subject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceEvent',
        source: 'user',
        status: 'pending',
        comment: 'User initiated age verification',
      },
    })

    const { subjectStatuses: pendingStatus } = await modClient.queryStatuses({
      subject: sc.dids.bob,
    })
    expect(pendingStatus[0].ageAssuranceState).toBe('pending')

    await modClient.emitEvent({
      subject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceEvent',
        source: 'admin',
        status: 'unknown',
        comment: 'Age verification failed or incomplete',
      },
    })
    const { subjectStatuses: unknownStatus } = await modClient.queryStatuses({
      subject: sc.dids.bob,
    })
    expect(unknownStatus[0].ageAssuranceState).toBe('unknown')
  })

  it('sets age assurance state to assured', async () => {
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.carol,
    }

    await modClient.emitEvent({
      subject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceEvent',
        source: 'admin',
        status: 'assured',
        comment: 'Age verification completed successfully',
        attemptId: 'attempt-456',
      },
    })

    const { subjectStatuses } = await modClient.queryStatuses({
      subject: sc.dids.carol,
    })

    expect(subjectStatuses[0].ageAssuranceState).toBe('assured')
  })

  it('defaults to unknown age assurance state for new subjects', async () => {
    const { subjectStatuses } = await modClient.queryStatuses({})

    const subjectsWithoutAgeEvents = subjectStatuses.filter(
      (status) =>
        status.subject.$type === 'com.atproto.admin.defs#repoRef' &&
        ![sc.dids.alice, sc.dids.bob, sc.dids.carol].includes(
          (status.subject as any).did,
        ),
    )

    subjectsWithoutAgeEvents.forEach((status) => {
      expect(status.ageAssuranceState).toBe('unknown')
    })
  })

  it('errors for record subjects', async () => {
    const postSubject = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      cid: sc.posts[sc.dids.alice][0].ref.cidStr,
    }

    await expect(
      modClient.emitEvent({
        subject: postSubject,
        event: {
          $type: 'tools.ozone.moderation.defs#ageAssuranceEvent',
          source: 'admin',
          status: 'pending',
          comment: 'Testing age assurance on record subject',
        },
      }),
    ).rejects.toThrow('Invalid subject type')
  })
})
