import { TestNetworkNoAppView, uniqueLockId } from '@atproto/dev-env'
import { Database } from '../src'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import { IngesterConfig } from '../src/ingester/config'
import { Redis } from 'ioredis'
import { IndexerConfig } from '../src/indexer/config'
import BskyIngester from '../src/ingester'
import BskyIndexer from '../src/indexer'
import { wait } from '@atproto/common'

describe('server', () => {
  let network: TestNetworkNoAppView
  let indexer: BskyIndexer
  let ingester: BskyIngester

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'bsky_pipeline',
    })
    const pdsAgent = network.pds.getClient()
    const sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await network.processAll()
  })

  beforeAll(async () => {
    const ingesterCfg = IngesterConfig.readEnv({
      redisUrl: process.env.REDIS_URL,
      dbPostgresUrl: process.env.DB_POSTGRES_URL,
      dbPostgresSchema: 'appview_bsky_pipeline',
      repoProvider: network.pds.url.replace('http://', 'ws://'),
      repoSubLockId: uniqueLockId(),
    })
    const indexerCfg = IndexerConfig.readEnv({
      redisUrl: process.env.REDIS_URL,
      dbPostgresUrl: process.env.DB_POSTGRES_URL,
      dbPostgresSchema: 'appview_bsky_pipeline',
      indexerSubLockId: uniqueLockId(),
      indexerPartitionNames: ['repo:0'],
    })
    const db = Database.postgres({
      url: ingesterCfg.dbPostgresUrl,
      schema: ingesterCfg.dbPostgresSchema,
    })
    const redis = new Redis(ingesterCfg.redisUrl)
    indexer = BskyIndexer.create({ cfg: indexerCfg, db, redis })
    ingester = BskyIngester.create({ cfg: ingesterCfg, db, redis })
    console.log(
      'migrating',
      ingesterCfg.dbPostgresUrl,
      ingesterCfg.dbPostgresSchema,
    )
    await db.migrateToLatestOrThrow()
    await indexer.start()
    await ingester.start()
  })

  afterAll(async () => {
    await network.close()
  })

  afterAll(async () => {
    await ingester.destroy()
    await indexer.destroy()
  })

  it('test', async () => {
    while (Math.random() > 0) {
      await wait(1000)
    }
  })
})
