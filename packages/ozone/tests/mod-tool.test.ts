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

  it('filters events by batchId and supports pagination', async () => {
    const subject = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.carol][0].ref.uriStr,
      cid: sc.posts[sc.dids.carol][0].ref.cidStr,
    }

    const batchId1 = 'batch-123'
    const batchId2 = 'batch-456'

    // Create events with first batchId
    const event1 = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['batch1-event1'],
        negateLabelVals: [],
      },
      subject,
      modTool: {
        name: 'automod/1.1.3',
        meta: { batchId: batchId1 },
      },
    })

    const event2 = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['batch1-event2'],
        negateLabelVals: [],
      },
      subject,
      modTool: {
        name: 'automod/1.1.3',
        meta: { batchId: batchId1 },
      },
    })

    const event3 = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['batch1-event3'],
        negateLabelVals: [],
      },
      subject,
      modTool: {
        name: 'ozone-ui/workspace',
        meta: { batchId: batchId1 },
      },
    })

    // Create events with second batchId
    const event4 = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['batch2-event1'],
        negateLabelVals: [],
      },
      subject,
      modTool: {
        name: 'ozone-ui/workspace',
        meta: { batchId: batchId2 },
      },
    })

    // Create event without batchId
    const event5 = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['no-batch'],
        negateLabelVals: [],
      },
      subject,
    })

    // Test filtering by first batchId
    const batch1Results = await modClient.queryEvents({
      subject: subject.uri,
      batchId: batchId1,
    })

    expect(batch1Results.events).toHaveLength(3)
    const batch1EventIds = batch1Results.events.map((e) => e.id)
    expect(batch1EventIds).toContain(event1.id)
    expect(batch1EventIds).toContain(event2.id)
    expect(batch1EventIds).toContain(event3.id)
    expect(batch1EventIds).not.toContain(event4.id)
    expect(batch1EventIds).not.toContain(event5.id)

    // Verify all events have the correct batchId
    batch1Results.events.forEach((event) => {
      expect(event.modTool?.meta?.batchId).toBe(batchId1)
    })

    // Test filtering by second batchId
    const batch2Results = await modClient.queryEvents({
      subject: subject.uri,
      batchId: batchId2,
    })

    expect(batch2Results.events).toHaveLength(1)
    expect(batch2Results.events[0].id).toBe(event4.id)
    expect(batch2Results.events[0].modTool?.meta?.batchId).toBe(batchId2)

    // Test pagination with batchId filter
    const paginatedResults = await modClient.queryEvents({
      subject: subject.uri,
      batchId: batchId1,
      limit: 2,
    })

    expect(paginatedResults.events).toHaveLength(2)
    expect(paginatedResults.cursor).toBeTruthy()

    // Get next page
    const nextPageResults = await modClient.queryEvents({
      subject: subject.uri,
      batchId: batchId1,
      limit: 2,
      cursor: paginatedResults.cursor,
    })

    expect(nextPageResults.events).toHaveLength(1)

    // Verify all paginated results have correct batchId
    const allPaginatedEvents = paginatedResults.events.concat(
      nextPageResults.events,
    )
    allPaginatedEvents.forEach((event) => {
      expect(event.modTool?.meta?.batchId).toBe(batchId1)
    })

    // Verify we got all 3 events across pages
    const allPaginatedIds = paginatedResults.events
      .map((e) => e.id)
      .concat(nextPageResults.events.map((e) => e.id))
    expect(allPaginatedIds).toContain(event1.id)
    expect(allPaginatedIds).toContain(event2.id)
    expect(allPaginatedIds).toContain(event3.id)
  })
})
