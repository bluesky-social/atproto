import { wait } from '@atproto/common'
import {
  BskyIndexers,
  TestNetworkNoAppView,
  getIndexers,
  getIngester,
  processAll,
  SeedClient,
  basicSeed,
} from '@atproto/dev-env'
import { BskyIngester } from '../../src'

const TEST_NAME = 'pipeline_backpressure'

describe('pipeline backpressure', () => {
  let network: TestNetworkNoAppView
  let ingester: BskyIngester
  let indexers: BskyIndexers

  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: TEST_NAME,
    })
    ingester = await getIngester(network, {
      name: TEST_NAME,
      ingesterPartitionCount: 2,
      ingesterMaxItems: 10,
      ingesterCheckItemsEveryN: 5,
    })
    indexers = await getIndexers(network, {
      name: TEST_NAME,
      partitionIdsByIndexer: [[0], [1]],
    })
    sc = network.getSeedClient()
    await basicSeed(sc)
  })

  afterAll(async () => {
    await network.close()
  })

  it('ingester issues backpressure based on total of partition lengths.', async () => {
    // ingest until first 10 are seen
    await ingester.start()
    while ((ingester.sub.lastSeq ?? 0) < 10) {
      await wait(50)
    }
    // allow additional time to pass to ensure no additional events are being consumed
    await wait(200)
    // check that max items has been respected (i.e. backpressure was applied)
    const lengths = await ingester.ctx.redis.streamLengths(['repo:0', 'repo:1'])
    expect(lengths).toHaveLength(2)
    expect(lengths[0] + lengths[1]).toBeLessThanOrEqual(10 + 5) // not exact due to batching, may catch on following check backpressure
    // drain all items using indexers, releasing backpressure
    await indexers.start()
    await processAll(network, ingester)
    const lengthsFinal = await ingester.ctx.redis.streamLengths([
      'repo:0',
      'repo:1',
    ])
    expect(lengthsFinal).toHaveLength(2)
    expect(lengthsFinal[0] + lengthsFinal[1]).toEqual(0)
    await indexers.destroy()
    await ingester.destroy()
  })
})
