import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { forSnapshot } from './_util'

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

  it('handles age assurance events from user', async () => {
    const aliceSubject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.alice,
    }
    const bobSubject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.bob,
    }

    const alicePendingEvent = await modClient.emitEvent({
      subject: aliceSubject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceEvent',
        status: 'pending',
        createdAt: new Date().toISOString(),
        attemptId: 'attempt-123',
        initIp: '123.456.789.012',
        initUa: 'Mozilla/5.0',
      },
    })

    const bobPendingEvent = await modClient.emitEvent({
      subject: bobSubject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceEvent',
        status: 'pending',
        createdAt: new Date().toISOString(),
        attemptId: 'attempt-345',
        initIp: '234.567.890.123',
        initUa: 'Mozilla/5.0',
      },
    })

    const bobAssuredEvent = await modClient.emitEvent({
      subject: bobSubject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceEvent',
        status: 'assured',
        createdAt: new Date().toISOString(),
        attemptId: 'attempt-345',
        initIp: '234.567.890.123',
        initUa: 'Mozilla/5.0',
        completeIp: '345.678.901.234',
        completeUa: 'Mozilla/5.0',
      },
    })

    expect(forSnapshot(alicePendingEvent)).toMatchSnapshot()
    expect(forSnapshot(bobPendingEvent)).toMatchSnapshot()
    expect(forSnapshot(bobAssuredEvent)).toMatchSnapshot()

    // Verify that age assurance state is correctly set for each subject
    const [{ subjectStatuses: aliceStatus }, { subjectStatuses: bobStatus }] =
      await Promise.all([
        modClient.queryStatuses({
          subject: sc.dids.alice,
        }),
        modClient.queryStatuses({
          subject: sc.dids.bob,
        }),
      ])

    expect(aliceStatus[0].ageAssuranceState).toBe('pending')
    expect(bobStatus[0].ageAssuranceState).toBe('assured')

    // Verify that queryEvents allow filtering by ageAssuranceState
    try {
      const [{ events: pendingEvents }, { events: unknownEvents }] =
        await Promise.all([
          modClient.queryEvents({
            ageAssuranceState: 'pending',
          }),
          modClient.queryEvents({
            ageAssuranceState: 'assured',
          }),
        ])
      expect(pendingEvents.length).toEqual(2)
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
        expect((event.event as any).status).toBe('assured')
      })
    } catch (error) {
      console.error('Error querying events:', error)
      throw error
    }

    // Verify that queryStatuses allows filtering by ageAssuranceState
    const { subjectStatuses: pendingStatuses } = await modClient.queryStatuses({
      ageAssuranceState: 'pending',
    })
    expect(pendingStatuses.length).toEqual(1)
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
          status: 'pending',
          createdAt: new Date().toISOString(),
          attemptId: 'attempt-123',
        },
      }),
    ).rejects.toThrow('Invalid subject type')
  })

  it('admin override behavior for age assurance states', async () => {
    const carolSubject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.carol,
    }

    // Verify that user emitted state is overridden by admin emitted state
    await modClient.emitEvent({
      subject: carolSubject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceEvent',
        status: 'pending',
        createdAt: new Date().toISOString(),
        attemptId: 'attempt-carol-1',
      },
    })

    const { subjectStatuses } = await modClient.queryStatuses({
      subject: sc.dids.carol,
    })
    expect(subjectStatuses[0].ageAssuranceState).toBe('pending')
    expect(subjectStatuses[0].ageAssuranceUpdatedBy).toBe('user')

    await modClient.emitEvent({
      subject: carolSubject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceOverrideEvent',
        status: 'assured',
        comment: 'Admin verification completed',
      },
    })

    const { subjectStatuses: afterAdminAssurance } =
      await modClient.queryStatuses({
        subject: sc.dids.carol,
      })
    expect(afterAdminAssurance[0].ageAssuranceState).toBe('assured')
    expect(afterAdminAssurance[0].ageAssuranceUpdatedBy).toBe('admin')

    // Verify that user emitted state can not override admin emitted state
    await modClient.emitEvent({
      subject: carolSubject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceEvent',
        status: 'pending',
        createdAt: new Date().toISOString(),
        attemptId: 'attempt-carol-2',
      },
    })

    const { subjectStatuses: afterCarolsAttempt } =
      await modClient.queryStatuses({
        subject: sc.dids.carol,
      })
    expect(afterCarolsAttempt[0].ageAssuranceState).toBe('assured')
    expect(afterCarolsAttempt[0].ageAssuranceUpdatedBy).toBe('admin')

    // Verify that admin can reset state to allow the user to override
    await modClient.emitEvent({
      subject: carolSubject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceOverrideEvent',
        status: 'reset',
        comment: 'Reset to allow user to set state again',
      },
    })

    const { subjectStatuses: afterReset } = await modClient.queryStatuses({
      subject: sc.dids.carol,
    })
    expect(afterReset[0].ageAssuranceState).toBe('reset')
    expect(afterReset[0].ageAssuranceUpdatedBy).toBe('admin')

    await modClient.emitEvent({
      subject: carolSubject,
      event: {
        $type: 'tools.ozone.moderation.defs#ageAssuranceEvent',
        status: 'assured',
        createdAt: new Date().toISOString(),
        attemptId: 'attempt-carol-3',
      },
    })

    const { subjectStatuses: afterCarolAssured } =
      await modClient.queryStatuses({
        subject: sc.dids.carol,
      })
    expect(afterCarolAssured[0].ageAssuranceState).toBe('assured')
    expect(afterCarolAssured[0].ageAssuranceUpdatedBy).toBe('user')
  })
})
