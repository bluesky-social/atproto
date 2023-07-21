import { TestNetworkNoAppView } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { BskyIndexers, getIndexers, getIngester, processAll } from './util'
import { BskyIngester } from '../../src'
import { countAll } from '../../src/db/util'

const TEST_NAME = 'pipeline_reingest'

describe('pipeline reingestion', () => {
  let network: TestNetworkNoAppView
  let ingester: BskyIngester
  let indexers: BskyIndexers

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: TEST_NAME,
    })
    ingester = await getIngester(network, {
      name: TEST_NAME,
      ingesterPartitionCount: 1,
    })
    indexers = await getIndexers(network, {
      name: TEST_NAME,
      partitionIdsByIndexer: [[0]],
    })
    await ingester.start()
    await indexers.start()
    const pdsAgent = network.pds.getClient()
    const sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await processAll(network, ingester)
  })

  afterAll(async () => {
    await network.close()
    await ingester.destroy()
    await indexers.destroy()
  })

  it('basic test.', async () => {
    const actors = await indexers.db.db
      .selectFrom('actor')
      .select(countAll.as('count'))
      .executeTakeFirstOrThrow()
    expect(actors.count).toEqual(4)
  })
})
