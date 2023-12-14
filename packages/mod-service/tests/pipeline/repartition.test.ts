import {
  BskyIndexers,
  TestNetworkNoAppView,
  SeedClient,
  getIndexers,
  getIngester,
  ingestAll,
  processAll,
} from '@atproto/dev-env'
import usersSeed from '../seeds/users'
import { BskyIngester } from '../../src'
import { countAll } from '../../src/db/util'

const TEST_NAME = 'pipeline_repartition'

describe('pipeline indexer repartitioning', () => {
  let network: TestNetworkNoAppView
  let ingester: BskyIngester
  let indexers1: BskyIndexers
  let indexers2: BskyIndexers
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: TEST_NAME,
    })
    ingester = await getIngester(network, {
      name: TEST_NAME,
      ingesterPartitionCount: 2,
    })
    indexers1 = await getIndexers(network, {
      name: TEST_NAME,
      partitionIdsByIndexer: [[0, 1]], // one indexer consuming two partitions
    })
    indexers2 = await getIndexers(network, {
      name: TEST_NAME,
      partitionIdsByIndexer: [[0], [1]], // two indexers, each consuming one partition
    })
    sc = network.getSeedClient()
    await usersSeed(sc)
  })

  afterAll(async () => {
    await network.close()
  })

  it('indexers repartition without missing events.', async () => {
    const poster = createPoster(sc)
    await Promise.all([poster.post(4), indexers1.start(), ingester.start()])
    await poster.post(1)
    await processAll(network, ingester)
    const { count: indexedPosts } = await indexers1.db.db
      .selectFrom('post')
      .select(countAll.as('count'))
      .executeTakeFirstOrThrow()
    expect(indexedPosts).toEqual(5)
    await Promise.all([poster.post(3), indexers1.destroy()])
    await poster.post(3) // miss some events
    await ingestAll(network, ingester)
    await Promise.all([poster.post(3), indexers2.start()]) // handle some events on indexers2
    await processAll(network, ingester)
    const { count: allIndexedPosts } = await indexers2.db.db
      .selectFrom('post')
      .select(countAll.as('count'))
      .executeTakeFirstOrThrow()
    expect(allIndexedPosts).toBeGreaterThan(indexedPosts)
    expect(allIndexedPosts).toEqual(poster.postCount)
    await indexers2.destroy()
    await ingester.destroy()
  })
})

function createPoster(sc: SeedClient) {
  return {
    postCount: 0,
    destroyed: false,
    async post(n = 1) {
      const dids = Object.values(sc.dids)
      for (let i = 0; i < n; ++i) {
        const did = dids[this.postCount % dids.length]
        await sc.post(did, `post ${this.postCount}`)
        this.postCount++
      }
    },
  }
}
