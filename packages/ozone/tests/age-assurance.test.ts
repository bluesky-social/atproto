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

  it('handles age assurance events and filtering', async () => {
    // Create subjects for testing different age assurance states
    const aliceSubject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.alice,
    }
    const bobSubject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.bob,
    }
    const carolSubject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.carol,
    }

    await modClient.emitEvent({
      subject: aliceSubject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceEvent',
        source: 'user',
        status: 'pending',
        comment: 'Age verification requested',
        attemptId: 'attempt-123',
      },
    })

    await modClient.emitEvent({
      subject: bobSubject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceEvent',
        source: 'user',
        status: 'pending',
        comment: 'User initiated age verification',
      },
    })

    await modClient.emitEvent({
      subject: bobSubject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceEvent',
        source: 'admin',
        status: 'unknown',
        comment: 'Age verification failed or incomplete',
      },
    })

    await modClient.emitEvent({
      subject: carolSubject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceEvent',
        source: 'admin',
        status: 'assured',
        comment: 'Age verification completed successfully',
        attemptId: 'attempt-456',
      },
    })

    // Verify that age assurance state is correctly set for each subject
    const [
      { subjectStatuses: aliceStatus },
      { subjectStatuses: bobStatus },
      { subjectStatuses: carolStatus },
    ] = await Promise.all([
      modClient.queryStatuses({
        subject: sc.dids.alice,
      }),
      modClient.queryStatuses({
        subject: sc.dids.bob,
      }),
      modClient.queryStatuses({
        subject: sc.dids.carol,
      }),
    ])

    expect(aliceStatus[0].ageAssuranceState).toBe('pending')
    expect(bobStatus[0].ageAssuranceState).toBe('unknown')
    expect(carolStatus[0].ageAssuranceState).toBe('assured')

    // Verify that queryEvents allow filtering by ageAssuranceState
    const [{ events: pendingEvents }, { events: unknownEvents }] =
      await Promise.all([
        modClient.queryEvents({
          ageAssuranceState: 'pending',
        }),
        modClient.queryEvents({
          ageAssuranceState: 'unknown',
        }),
      ])
    expect(pendingEvents.length).toBeGreaterThan(0)
    pendingEvents.forEach((event) => {
      expect(event.event.$type).toBe(
        'tools.ozone.moderation.defs#ageAssuranceEvent',
      )
      expect((event.event as any).status).toBe('pending')
    })

    expect(unknownEvents.length).toBeGreaterThan(0)
    unknownEvents.forEach((event) => {
      expect(event.event.$type).toBe(
        'tools.ozone.moderation.defs#ageAssuranceEvent',
      )
      expect((event.event as any).status).toBe('unknown')
    })

    // Verify that queryStatuses allows filtering by ageAssuranceState
    const { subjectStatuses: pendingStatuses } = await modClient.queryStatuses({
      ageAssuranceState: 'pending',
    })
    expect(pendingStatuses.length).toBeGreaterThan(0)
    pendingStatuses.forEach((status) => {
      expect(status.ageAssuranceState).toBe('pending')
    })
  })

  it('age assurance event fails for record subjects', async () => {
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
