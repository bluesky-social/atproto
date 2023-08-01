import assert from 'assert'
import { Deferrable, createDeferrable, wait } from '@atproto/common'
import {
  BskyIndexers,
  TestNetworkNoAppView,
  getIndexers,
  getIngester,
  processAll,
} from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
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
    const pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await usersSeed(sc)
  })

  afterAll(async () => {
    await network.close()
  })

  it('indexers repartition without missing events.', async () => {
    const poster = createPoster(sc)
    poster.start()
    await indexers1.start()
    await ingester.start()
    await wait(500) // handle some events on indexers1
    const { count: indexedPosts } = await indexers1.db.db
      .selectFrom('post')
      .select(countAll.as('count'))
      .executeTakeFirstOrThrow()
    expect(indexedPosts).toBeGreaterThanOrEqual(1)
    await indexers1.destroy()
    await wait(500) // miss some events
    await indexers2.start()
    await wait(500) // handle some events on indexers2
    await poster.destroy()
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
  let running: Deferrable | undefined
  return {
    postCount: 0,
    destroyed: false,
    async start() {
      assert(!running && !this.destroyed)
      running = createDeferrable()
      const dids = Object.values(sc.dids)
      while (!this.destroyed) {
        const did = dids[this.postCount % dids.length]
        await sc.post(did, `post ${this.postCount}`)
        this.postCount++
        await wait(75)
      }
      running.resolve()
    },
    async destroy() {
      assert(running && !this.destroyed)
      this.destroyed = true
      await running.complete
    },
  }
}
