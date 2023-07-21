import { Redis } from 'ioredis'
import { wait } from '@atproto/common'
import { TestNetworkNoAppView, uniqueLockId } from '@atproto/dev-env'
import { Database } from '../src'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import { IngesterConfig } from '../src/ingester/config'
import { IndexerConfig } from '../src/indexer/config'
import BskyIngester from '../src/ingester'
import BskyIndexer from '../src/indexer'
import { countAll } from '../src/db/util'

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
    // indexer
    const indexerCfg = IndexerConfig.readEnv({
      redisUrl: process.env.REDIS_URL,
      dbPostgresUrl: process.env.DB_POSTGRES_URL,
      dbPostgresSchema: 'appview_bsky_pipeline',
      didPlcUrl: network.plc.url,
      indexerPartitionIds: [0],
      indexerSubLockId: uniqueLockId(),
    })
    const indexerDb = Database.postgres({
      url: indexerCfg.dbPostgresUrl,
      schema: indexerCfg.dbPostgresSchema,
    })
    const indexerRedis = new Redis(indexerCfg.redisUrl)
    indexer = BskyIndexer.create({
      cfg: indexerCfg,
      db: indexerDb,
      redis: indexerRedis,
    })
    // ingester
    const ingesterCfg = IngesterConfig.readEnv({
      redisUrl: process.env.REDIS_URL,
      dbPostgresUrl: process.env.DB_POSTGRES_URL,
      dbPostgresSchema: 'appview_bsky_pipeline',
      repoProvider: network.pds.url.replace('http://', 'ws://'),
      ingesterSubLockId: uniqueLockId(),
      ingesterPartitionCount: 1,
    })
    const ingesterDb = Database.postgres({
      url: ingesterCfg.dbPostgresUrl,
      schema: ingesterCfg.dbPostgresSchema,
    })
    const ingesterRedis = new Redis(ingesterCfg.redisUrl)
    ingester = BskyIngester.create({
      cfg: ingesterCfg,
      db: ingesterDb,
      redis: ingesterRedis,
    })
    // startup
    await indexerDb.migrateToLatestOrThrow()
    await indexer.start()
    await ingester.start()
  })

  afterAll(async () => {
    await network.close()
  })

  afterAll(async () => {
    await ingester.destroy()
    await indexer.destroy() // @TODO times out when destroying repoQueue
  })

  it('basic test.', async () => {
    await wait(5000)
    const actors = await indexer.ctx.db.db
      .selectFrom('actor')
      .select(countAll.as('count'))
      .executeTakeFirstOrThrow()
    expect(actors.count).toEqual(4)
  })
})
