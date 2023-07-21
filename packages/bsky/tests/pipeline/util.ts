import { TestNetworkNoAppView, uniqueLockId } from '@atproto/dev-env'
import {
  BskyIndexer,
  BskyIngester,
  Database,
  IngesterConfig,
  Redis,
} from '../../src'
import { randomIntFromSeed } from '@atproto/crypto'
import { IngesterConfigValues } from '../../src/ingester/config'
import { IndexerConfig, IndexerConfigValues } from '../../src/indexer/config'
import { DAY, HOUR, wait } from '@atproto/common'
import assert from 'assert'

export async function getIngester(
  network: TestNetworkNoAppView,
  opts: { name: string } & Partial<IngesterConfigValues>,
) {
  const { name, ...config } = opts
  const ns = name ? await randomIntFromSeed(name, 10000) : undefined
  const cfg = new IngesterConfig({
    version: '0.0.0',
    redisUrl: process.env.REDIS_URL || '',
    dbPostgresUrl: process.env.DB_POSTGRES_URL || '',
    dbPostgresSchema: `appview_${name}`,
    repoProvider: network.pds.url.replace('http://', 'ws://'),
    ingesterSubLockId: uniqueLockId(),
    ingesterPartitionCount: config.ingesterPartitionCount ?? 1,
    ingesterNamespace: `ns${ns}`,
    ...config,
  })
  const db = Database.postgres({
    url: cfg.dbPostgresUrl,
    schema: cfg.dbPostgresSchema,
  })
  const redis = new Redis(cfg.redisUrl)
  await db.migrateToLatestOrThrow()
  return BskyIngester.create({ cfg, db, redis })
}

// get multiple indexers for separate partitions, sharing db and redis instance.
export async function getIndexers(
  network: TestNetworkNoAppView,
  opts: Partial<IndexerConfigValues> & {
    name: string
    partitionIdsByIndexer: number[][]
  },
): Promise<BskyIndexers> {
  const { name, ...config } = opts
  const ns = name ? await randomIntFromSeed(name, 10000) : undefined
  const baseCfg: IndexerConfigValues = {
    version: '0.0.0',
    didCacheStaleTTL: HOUR,
    didCacheMaxTTL: DAY,
    labelerDid: 'did:example:labeler',
    labelerKeywords: { label_me: 'test-label', label_me_2: 'test-label-2' },
    redisUrl: process.env.REDIS_URL || '',
    dbPostgresUrl: process.env.DB_POSTGRES_URL || '',
    dbPostgresSchema: `appview_${name}`,
    didPlcUrl: network.plc.url,
    indexerPartitionIds: [0],
    indexerNamespace: `ns${ns}`,
    ...config,
  }
  const db = Database.postgres({
    url: baseCfg.dbPostgresUrl,
    schema: baseCfg.dbPostgresSchema,
  })
  const redis = new Redis(baseCfg.redisUrl)
  const indexers = opts.partitionIdsByIndexer.map((indexerPartitionIds) => {
    const cfg = new IndexerConfig({
      ...baseCfg,
      indexerPartitionIds,
      indexerSubLockId: uniqueLockId(),
    })
    return BskyIndexer.create({ cfg, db, redis })
  })
  await db.migrateToLatestOrThrow()
  return {
    db,
    list: indexers,
    async start() {
      await Promise.all(indexers.map((indexer) => indexer.start()))
    },
    async destroy() {
      const stopping = [...indexers]
      const lastIndexer = stopping.pop()
      await Promise.all(
        stopping.map((indexer) => indexer.destroy({ skipDb: true })),
      )
      await lastIndexer?.destroy()
    },
  }
}

export type BskyIndexers = {
  db: Database
  list: BskyIndexer[]
  start(): Promise<void>
  destroy(): Promise<void>
}

export async function processAll(
  network: TestNetworkNoAppView,
  ingester: BskyIngester,
) {
  assert(network.pds.ctx.sequencerLeader, 'sequencer leader does not exist')
  await network.pds.processAll()
  await ingestAll(network, ingester)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // check indexers
    let pipeline = ingester.ctx.redis.pipeline()
    for (let i = 0; i < ingester.sub.partitionCount; ++i) {
      pipeline = pipeline.xlen(ingester.sub.ns(`repo:${i}`))
    }
    const results = await pipeline.exec()
    const indexersCaughtUp = results?.every(
      ([err, len]) => err === null && len === 0,
    )
    if (indexersCaughtUp) return
    await wait(50)
  }
}

export async function ingestAll(
  network: TestNetworkNoAppView,
  ingester: BskyIngester,
) {
  assert(network.pds.ctx.sequencerLeader, 'sequencer leader does not exist')
  const pdsDb = network.pds.ctx.db.db
  await network.pds.processAll()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await wait(50)
    // check sequencer
    const sequencerCaughtUp = await network.pds.ctx.sequencerLeader.isCaughtUp()
    if (!sequencerCaughtUp) continue
    // check ingester
    const [ingesterCursor, { lastSeq }] = await Promise.all([
      ingester.sub.getCursor(),
      pdsDb
        .selectFrom('repo_seq')
        .where('seq', 'is not', null)
        .select(pdsDb.fn.max('repo_seq.seq').as('lastSeq'))
        .executeTakeFirstOrThrow(),
    ])
    const ingesterCaughtUp = ingesterCursor === lastSeq
    if (ingesterCaughtUp) return
  }
}
