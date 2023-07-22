import { TestNetworkNoAppView } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { BskyIndexers, getIndexers, getIngester, processAll } from './util'
import { BskyIngester } from '../../src'
import { wait } from '@atproto/common'

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
    const pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
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
    const lenResults = await ingester.ctx.redis
      .pipeline()
      .xlen(ingester.sub.ns('repo:0'))
      .xlen(ingester.sub.ns('repo:1'))
      .exec()
    const len0 = Number(lenResults?.[0][1]) || 0
    const len1 = Number(lenResults?.[1][1]) || 0
    expect(lenResults).toHaveLength(2)
    expect(len0 + len1).toEqual(10)
    // drain all items using indexers, releasing backpressure
    await indexers.start()
    await processAll(network, ingester)
    const lenResultsFinal = await ingester.ctx.redis
      .pipeline()
      .xlen(ingester.sub.ns('repo:0'))
      .xlen(ingester.sub.ns('repo:1'))
      .exec()
    const len0Final = Number(lenResultsFinal?.[0][1]) || 0
    const len1Final = Number(lenResultsFinal?.[1][1]) || 0
    expect(lenResultsFinal).toHaveLength(2)
    expect(len0Final).toEqual(0)
    expect(len1Final).toEqual(0)
    await indexers.destroy()
    await ingester.destroy()
  })
})
