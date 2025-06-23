import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'

describe('user-agent tracking', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_user_agent_test',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('stores and returns userAgent with name and extra metadata', async () => {
    const subject = {
      $type: 'com.atproto.repo.strongRef' as const,
      uri: sc.posts[sc.dids.bob][0].ref.uriStr,
      cid: sc.posts[sc.dids.bob][0].ref.cidStr,
    }

    const userAgent = {
      name: 'automod/1.1.3',
      extra: {
        confidence: 85,
        rules: ['high_risk_country', 'spam_detection'],
        version: '1.1.3',
        environment: 'production',
      },
    }

    const emittedEvent = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['spam'],
        negateLabelVals: [],
      },
      subject,
      userAgent,
    })

    expect(emittedEvent.userAgent).toEqual(userAgent)
    expect(emittedEvent.userAgent?.name).toBe('automod/1.1.3')
    expect(emittedEvent.userAgent?.extra).toEqual({
      confidence: 85,
      rules: ['high_risk_country', 'spam_detection'],
      version: '1.1.3',
      environment: 'production',
    })

    const queryResult = await modClient.queryEvents({
      subject: subject.uri,
    })

    const foundEvent = queryResult.events.find((e) => e.id === emittedEvent.id)
    expect(foundEvent?.userAgent).toEqual(userAgent)
  })

  it('filters events by userAgent name', async () => {
    const subject = {
      $type: 'com.atproto.repo.strongRef' as const,
      uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      cid: sc.posts[sc.dids.alice][0].ref.cidStr,
    }

    const event1 = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['test1'],
        negateLabelVals: [],
      },
      subject,
      userAgent: { name: 'automod/1.1.3' },
    })

    const event2 = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['test2'],
        negateLabelVals: [],
      },
      subject,
      userAgent: { name: 'ozone-web/1.0.0' },
    })

    const event3 = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['test3'],
        negateLabelVals: [],
      },
      subject,
      userAgent: { name: 'mobile-app/2.1.0' },
    })

    const automodResults = await modClient.queryEvents({
      subject: subject.uri,
      userAgent: ['automod/1.1.3'],
    })

    expect(automodResults.events).toHaveLength(1)
    expect(automodResults.events[0].id).toBe(event1.id)
    expect(automodResults.events[0].userAgent?.name).toBe('automod/1.1.3')

    const multipleResults = await modClient.queryEvents({
      subject: subject.uri,
      userAgent: ['automod/1.1.3', 'ozone-web/1.0.0'],
    })

    expect(multipleResults.events).toHaveLength(2)
    const eventIds = multipleResults.events.map((e) => e.id)
    expect(eventIds).toContain(event1.id)
    expect(eventIds).toContain(event2.id)
    expect(eventIds).not.toContain(event3.id)
  })
})
