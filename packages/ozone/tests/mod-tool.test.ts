import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'

describe('mod-tool tracking', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_mod_tool_test',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('stores and returns modTool with name and meta metadata', async () => {
    const subject = {
      $type: 'com.atproto.repo.strongRef' as const,
      uri: sc.posts[sc.dids.bob][0].ref.uriStr,
      cid: sc.posts[sc.dids.bob][0].ref.cidStr,
    }

    const modTool = {
      name: 'automod/1.1.3',
      meta: {
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
      modTool,
    })

    expect(emittedEvent.modTool).toEqual(modTool)
    expect(emittedEvent.modTool?.name).toBe('automod/1.1.3')
    expect(emittedEvent.modTool?.meta).toEqual({
      confidence: 85,
      rules: ['high_risk_country', 'spam_detection'],
      version: '1.1.3',
      environment: 'production',
    })

    const queryResult = await modClient.queryEvents({
      subject: subject.uri,
    })

    const foundEvent = queryResult.events.find((e) => e.id === emittedEvent.id)
    expect(foundEvent?.modTool).toEqual(modTool)
  })

  it('filters events by modTool name', async () => {
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
      modTool: { name: 'automod/1.1.3' },
    })

    const event2 = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['test2'],
        negateLabelVals: [],
      },
      subject,
      modTool: { name: 'ozone-web/1.0.0' },
    })

    const event3 = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['test3'],
        negateLabelVals: [],
      },
      subject,
      modTool: { name: 'mobile-app/2.1.0' },
    })

    const automodResults = await modClient.queryEvents({
      subject: subject.uri,
      modTool: ['automod/1.1.3'],
    })

    expect(automodResults.events).toHaveLength(1)
    expect(automodResults.events[0].id).toBe(event1.id)
    expect(automodResults.events[0].modTool?.name).toBe('automod/1.1.3')

    const multipleResults = await modClient.queryEvents({
      subject: subject.uri,
      modTool: ['automod/1.1.3', 'ozone-web/1.0.0'],
    })

    expect(multipleResults.events).toHaveLength(2)
    const eventIds = multipleResults.events.map((e) => e.id)
    expect(eventIds).toContain(event1.id)
    expect(eventIds).toContain(event2.id)
    expect(eventIds).not.toContain(event3.id)
  })
})
