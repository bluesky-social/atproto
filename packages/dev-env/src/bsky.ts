import assert from 'assert'
import getPort from 'get-port'
import * as ui8 from 'uint8arrays'
import * as bsky from '@atproto/bsky'
import { DAY, HOUR, wait } from '@atproto/common-web'
import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair, randomIntFromSeed } from '@atproto/crypto'
import { Client as PlcClient } from '@did-plc/lib'
import { BskyConfig } from './types'
import { uniqueLockId } from './util'
import { TestNetworkNoAppView } from './network-no-appview'

export class TestBsky {
  constructor(
    public url: string,
    public port: number,
    public server: bsky.BskyAppView,
    public indexer: bsky.BskyIndexer,
    public ingester: bsky.BskyIngester,
  ) {}

  static async create(cfg: BskyConfig): Promise<TestBsky> {
    const serviceKeypair = await Secp256k1Keypair.create()
    const plcClient = new PlcClient(cfg.plcUrl)

    const port = cfg.port || (await getPort())
    const url = `http://localhost:${port}`
    const serverDid = await plcClient.createDid({
      signingKey: serviceKeypair.did(),
      rotationKeys: [serviceKeypair.did()],
      handle: 'bsky.test',
      pds: `http://localhost:${port}`,
      signer: serviceKeypair,
    })

    const config = new bsky.ServerConfig({
      version: '0.0.0',
      port,
      didPlcUrl: cfg.plcUrl,
      publicUrl: 'https://bsky.public.url',
      serverDid,
      imgUriSalt: '9dd04221f5755bce5f55f47464c27e1e',
      imgUriKey:
        'f23ecd142835025f42c3db2cf25dd813956c178392760256211f9d315f8ab4d8',
      didCacheStaleTTL: HOUR,
      didCacheMaxTTL: DAY,
      ...cfg,
      // Each test suite gets its own lock id for the repo subscription
      adminPassword: 'admin-pass',
      moderatorPassword: 'moderator-pass',
      triagePassword: 'triage-pass',
      labelerDid: 'did:example:labeler',
      feedGenDid: 'did:example:feedGen',
    })

    // shared across server, ingester, and indexer in order to share pool, avoid too many pg connections.
    const db = bsky.Database.postgres({
      url: cfg.dbPostgresUrl,
      schema: cfg.dbPostgresSchema,
      poolSize: 10,
    })

    // Separate migration db in case migration changes some connection state that we need in the tests, e.g. "alter database ... set ..."
    const migrationDb = bsky.Database.postgres({
      url: cfg.dbPostgresUrl,
      schema: cfg.dbPostgresSchema,
    })
    if (cfg.migration) {
      await migrationDb.migrateToOrThrow(cfg.migration)
    } else {
      await migrationDb.migrateToLatestOrThrow()
    }
    await migrationDb.close()

    // api server
    const server = bsky.BskyAppView.create({ db, config, algos: cfg.algos })
    // indexer
    const ns = cfg.dbPostgresSchema
      ? await randomIntFromSeed(cfg.dbPostgresSchema, 10000)
      : undefined
    const indexerCfg = new bsky.IndexerConfig({
      version: '0.0.0',
      didCacheStaleTTL: HOUR,
      didCacheMaxTTL: DAY,
      labelerDid: 'did:example:labeler',
      redisHost: cfg.redisHost,
      dbPostgresUrl: cfg.dbPostgresUrl,
      dbPostgresSchema: cfg.dbPostgresSchema,
      didPlcUrl: cfg.plcUrl,
      labelerKeywords: { label_me: 'test-label', label_me_2: 'test-label-2' },
      indexerPartitionIds: [0],
      indexerNamespace: `ns${ns}`,
      indexerSubLockId: uniqueLockId(),
    })
    assert(indexerCfg.redisHost)
    const indexerRedis = new bsky.Redis({
      host: indexerCfg.redisHost,
      namespace: indexerCfg.indexerNamespace,
    })
    const indexer = bsky.BskyIndexer.create({
      cfg: indexerCfg,
      db,
      redis: indexerRedis,
    })
    // ingester
    const ingesterCfg = new bsky.IngesterConfig({
      version: '0.0.0',
      redisHost: cfg.redisHost,
      dbPostgresUrl: cfg.dbPostgresUrl,
      dbPostgresSchema: cfg.dbPostgresSchema,
      repoProvider: cfg.repoProvider,
      ingesterNamespace: `ns${ns}`,
      ingesterSubLockId: uniqueLockId(),
      ingesterPartitionCount: 1,
    })
    assert(ingesterCfg.redisHost)
    const ingesterRedis = new bsky.Redis({
      host: ingesterCfg.redisHost,
      namespace: ingesterCfg.ingesterNamespace,
    })
    const ingester = bsky.BskyIngester.create({
      cfg: ingesterCfg,
      db,
      redis: ingesterRedis,
    })
    await ingester.start()
    await indexer.start()
    await server.start()

    // we refresh label cache by hand in `processAll` instead of on a timer
    server.ctx.labelCache.stop()
    return new TestBsky(url, port, server, indexer, ingester)
  }

  get ctx(): bsky.AppContext {
    return this.server.ctx
  }

  get sub() {
    return this.indexer.sub
  }

  getClient() {
    return new AtpAgent({ service: this.url })
  }

  adminAuth(role: 'admin' | 'moderator' | 'triage' = 'admin'): string {
    const password =
      role === 'triage'
        ? this.ctx.cfg.triagePassword
        : role === 'moderator'
        ? this.ctx.cfg.moderatorPassword
        : this.ctx.cfg.adminPassword
    return (
      'Basic ' +
      ui8.toString(ui8.fromString(`admin:${password}`, 'utf8'), 'base64pad')
    )
  }

  adminAuthHeaders(role?: 'admin' | 'moderator' | 'triage') {
    return {
      authorization: this.adminAuth(role),
    }
  }

  async processAll() {
    await Promise.all([
      this.ctx.backgroundQueue.processAll(),
      this.indexer.ctx.backgroundQueue.processAll(),
      this.ctx.labelCache.fullRefresh(),
    ])
  }

  async close() {
    await this.server.destroy({ skipDb: true })
    await this.ingester.destroy({ skipDb: true })
    await this.indexer.destroy() // closes shared db
  }
}

// Below are used for tests just of component parts of the appview, i.e. ingester and indexers:

export async function getIngester(
  network: TestNetworkNoAppView,
  opts: { name: string } & Partial<bsky.IngesterConfigValues>,
) {
  const { name, ...config } = opts
  const ns = name ? await randomIntFromSeed(name, 10000) : undefined
  const cfg = new bsky.IngesterConfig({
    version: '0.0.0',
    redisHost: process.env.REDIS_HOST || '',
    dbPostgresUrl: process.env.DB_POSTGRES_URL || '',
    dbPostgresSchema: `appview_${name}`,
    repoProvider: network.pds.url.replace('http://', 'ws://'),
    ingesterSubLockId: uniqueLockId(),
    ingesterPartitionCount: config.ingesterPartitionCount ?? 1,
    ingesterNamespace: `ns${ns}`,
    ...config,
  })
  const db = bsky.Database.postgres({
    url: cfg.dbPostgresUrl,
    schema: cfg.dbPostgresSchema,
  })
  assert(cfg.redisHost)
  const redis = new bsky.Redis({
    host: cfg.redisHost,
    namespace: cfg.ingesterNamespace,
  })
  await db.migrateToLatestOrThrow()
  return bsky.BskyIngester.create({ cfg, db, redis })
}

// get multiple indexers for separate partitions, sharing db and redis instance.
export async function getIndexers(
  network: TestNetworkNoAppView,
  opts: Partial<bsky.IndexerConfigValues> & {
    name: string
    partitionIdsByIndexer: number[][]
  },
): Promise<BskyIndexers> {
  const { name, ...config } = opts
  const ns = name ? await randomIntFromSeed(name, 10000) : undefined
  const baseCfg: bsky.IndexerConfigValues = {
    version: '0.0.0',
    didCacheStaleTTL: HOUR,
    didCacheMaxTTL: DAY,
    labelerDid: 'did:example:labeler',
    labelerKeywords: { label_me: 'test-label', label_me_2: 'test-label-2' },
    redisHost: process.env.REDIS_HOST || '',
    dbPostgresUrl: process.env.DB_POSTGRES_URL || '',
    dbPostgresSchema: `appview_${name}`,
    didPlcUrl: network.plc.url,
    indexerPartitionIds: [0],
    indexerNamespace: `ns${ns}`,
    ...config,
  }
  const db = bsky.Database.postgres({
    url: baseCfg.dbPostgresUrl,
    schema: baseCfg.dbPostgresSchema,
  })
  assert(baseCfg.redisHost)
  const redis = new bsky.Redis({
    host: baseCfg.redisHost,
    namespace: baseCfg.indexerNamespace,
  })
  const indexers = opts.partitionIdsByIndexer.map((indexerPartitionIds) => {
    const cfg = new bsky.IndexerConfig({
      ...baseCfg,
      indexerPartitionIds,
      indexerSubLockId: uniqueLockId(),
    })
    return bsky.BskyIndexer.create({ cfg, db, redis })
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
        stopping.map((indexer) =>
          indexer.destroy({ skipDb: true, skipRedis: true }),
        ),
      )
      await lastIndexer?.destroy()
    },
  }
}

export type BskyIndexers = {
  db: bsky.Database
  list: bsky.BskyIndexer[]
  start(): Promise<void>
  destroy(): Promise<void>
}

export async function processAll(
  network: TestNetworkNoAppView,
  ingester: bsky.BskyIngester,
) {
  assert(network.pds.ctx.sequencerLeader, 'sequencer leader does not exist')
  await network.pds.processAll()
  await ingestAll(network, ingester)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // check indexers
    const keys = [...Array(ingester.sub.opts.partitionCount)].map(
      (_, i) => `repo:${i}`,
    )
    const results = await ingester.sub.ctx.redis.streamLengths(keys)
    const indexersCaughtUp = results.every((len) => len === 0)
    if (indexersCaughtUp) return
    await wait(50)
  }
}

export async function ingestAll(
  network: TestNetworkNoAppView,
  ingester: bsky.BskyIngester,
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
