import {
  TestNetworkNoAppView,
  SeedClient,
  getIngester,
  ingestAll,
  basicSeed,
} from '@atproto/dev-env'
import { BskyIngester } from '../../src'

const TEST_NAME = 'pipeline_reingest'

describe('pipeline reingestion', () => {
  let network: TestNetworkNoAppView
  let ingester: BskyIngester
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: TEST_NAME,
    })
    ingester = await getIngester(network, {
      name: TEST_NAME,
      ingesterPartitionCount: 1,
    })
    sc = network.getSeedClient()
    await basicSeed(sc)
  })

  afterAll(async () => {
    await network.close()
    await ingester.destroy()
  })

  it('allows events to be reingested multiple times.', async () => {
    // ingest all events once
    await ingester.start()
    await ingestAll(network, ingester)
    const initialCursor = await ingester.sub.getCursor()
    const [initialLen] = await ingester.ctx.redis.streamLengths(['repo:0'])
    expect(initialCursor).toBeGreaterThan(10)
    expect(initialLen).toBeGreaterThan(10)
    // stop ingesting and reset ingester state
    await ingester.sub.destroy()
    await ingester.sub.resetCursor()
    // add one new event and reingest
    await sc.post(sc.dids.alice, 'one more event!') // add one event to firehose
    ingester.sub.resume()
    await ingestAll(network, ingester)
    // confirm the newest event was ingested
    const finalCursor = await ingester.sub.getCursor()
    const [finalLen] = await ingester.ctx.redis.streamLengths(['repo:0'])
    expect(finalCursor).toEqual(initialCursor + 1)
    expect(finalLen).toEqual(initialLen + 1)
  })
})
