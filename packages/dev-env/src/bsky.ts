import assert from 'assert'
import getPort from 'get-port'
import * as ui8 from 'uint8arrays'
import * as bsky from '@atproto/bsky'
import { DAY, HOUR, MINUTE, SECOND, wait } from '@atproto/common-web'
import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair, randomIntFromSeed } from '@atproto/crypto'
import { Client as PlcClient } from '@did-plc/lib'
import { BskyConfig } from './types'
import { uniqueLockId } from './util'
import { TestNetworkNoAppView } from './network-no-appview'
import { ADMIN_PASSWORD, MOD_PASSWORD, TRIAGE_PASSWORD } from './const'

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
      didCacheStaleTTL: HOUR,
      didCacheMaxTTL: DAY,
      labelCacheStaleTTL: 30 * SECOND,
      labelCacheMaxTTL: MINUTE,
      modServiceDid: cfg.modServiceDid ?? 'did:example:invalidMod',
      ...cfg,
      // Each test suite gets its own lock id for the repo subscription
      adminPassword: ADMIN_PASSWORD,
      moderatorPassword: MOD_PASSWORD,
      triagePassword: TRIAGE_PASSWORD,
      feedGenDid: 'did:example:feedGen',
      rateLimitsEnabled: false,
    })

    // shared across server, ingester, and indexer in order to share pool, avoid too many pg connections.
    const db = new bsky.DatabaseCoordinator({
      schema: cfg.dbPostgresSchema,
      primary: {
        url: cfg.dbPrimaryPostgresUrl,
        poolSize: 10,
      },
      replicas: [],
    })

    // Separate migration db in case migration changes some connection state that we need in the tests, e.g. "alter database ... set ..."
    const migrationDb = new bsky.PrimaryDatabase({
      url: cfg.dbPrimaryPostgresUrl,
      schema: cfg.dbPostgresSchema,
    })
    if (cfg.migration) {
      await migrationDb.migrateToOrThrow(cfg.migration)
    } else {
      await migrationDb.migrateToLatestOrThrow()
    }
    await migrationDb.close()

    const ns = cfg.dbPostgresSchema
      ? await randomIntFromSeed(cfg.dbPostgresSchema, 1000000)
      : undefined
    assert(config.redisHost)
    const redisCache = new bsky.Redis({
      host: config.redisHost,
      namespace: `ns${ns}`,
      db: 1,
    })

    // api server
    const server = bsky.BskyAppView.create({
      db,
      redis: redisCache,
      config,
      imgInvalidator: cfg.imgInvalidator,
      signingKey: serviceKeypair,
    })
    // indexer
    const indexerCfg = new bsky.IndexerConfig({
      version: '0.0.0',
      serverDid,
      didCacheStaleTTL: HOUR,
      didCacheMaxTTL: DAY,
      redisHost: cfg.redisHost,
      dbPostgresUrl: cfg.dbPrimaryPostgresUrl,
      dbPostgresSchema: cfg.dbPostgresSchema,
      didPlcUrl: cfg.plcUrl,
      labelerKeywords: { label_me: 'test-label', label_me_2: 'test-label-2' },
      abyssEndpoint: '',
      abyssPassword: '',
      imgUriEndpoint: 'img.example.com',
      moderationPushUrl:
        cfg.indexer?.moderationPushUrl ?? 'https://modservice.invalid',
      indexerPartitionIds: [0],
      indexerNamespace: `ns${ns}`,
      indexerSubLockId: uniqueLockId(),
      indexerPort: await getPort(),
      ingesterPartitionCount: 1,
      pushNotificationEndpoint: 'https://push.bsky.app/api/push',
      ...(cfg.indexer ?? {}),
    })
    assert(indexerCfg.redisHost)
    const indexerRedis = new bsky.Redis({
      host: indexerCfg.redisHost,
      namespace: `ns${ns}`,
    })

    const indexer = bsky.BskyIndexer.create({
      cfg: indexerCfg,
      db: db.getPrimary(),
      redis: indexerRedis,
      redisCache,
    })
    // ingester
    const ingesterCfg = new bsky.IngesterConfig({
      version: '0.0.0',
      redisHost: cfg.redisHost,
      dbPostgresUrl: cfg.dbPrimaryPostgresUrl,
      dbPostgresSchema: cfg.dbPostgresSchema,
      repoProvider: cfg.repoProvider,
      labelProvider: cfg.labelProvider,
      ingesterNamespace: `ns${ns}`,
      ingesterSubLockId: uniqueLockId(),
      ingesterPartitionCount: 1,
      ...(cfg.ingester ?? {}),
    })
    assert(ingesterCfg.redisHost)
    const ingesterRedis = new bsky.Redis({
      host: ingesterCfg.redisHost,
      namespace: ingesterCfg.ingesterNamespace,
    })
    const ingester = bsky.BskyIngester.create({
      cfg: ingesterCfg,
      db: db.getPrimary(),
      redis: ingesterRedis,
    })
    await ingester.start()
    await indexer.start()
    await server.start()

    // manually process labels in dev-env (in network.processAll)
    ingester.ctx.labelSubscription?.destroy()

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
    ])
  }

  async close() {
    await this.server.destroy({ skipDb: true, skipRedis: true })
    await this.ingester.destroy({ skipDb: true })
    await this.indexer.destroy() // closes shared db & redis
  }
}

// Below are used for tests just of component parts of the appview, i.e. ingester and indexers:

export async function getIngester(
  network: TestNetworkNoAppView,
  opts: { name: string } & Partial<bsky.IngesterConfigValues>,
) {
  const { name, ...config } = opts
  const ns = name ? await randomIntFromSeed(name, 1000000) : undefined
  const cfg = new bsky.IngesterConfig({
    version: '0.0.0',
    redisHost: process.env.REDIS_HOST || '',
    dbPostgresUrl: process.env.DB_POSTGRES_URL || '',
    dbPostgresSchema: `appview_${name}`,
    repoProvider: network.pds.url.replace('http://', 'ws://'),
    labelProvider: 'http://labeler.invalid',
    ingesterSubLockId: uniqueLockId(),
    ingesterPartitionCount: config.ingesterPartitionCount ?? 1,
    ingesterNamespace: `ns${ns}`,
    ...config,
  })
  const db = new bsky.PrimaryDatabase({
    url: cfg.dbPostgresUrl,
    schema: cfg.dbPostgresSchema,
  })
  assert(cfg.redisHost)
  const redis = new bsky.Redis({
    host: cfg.redisHost,
    namespace: cfg.ingesterNamespace,
  })
  await db.migrateToLatestOrThrow()
  const ingester = await bsky.BskyIngester.create({ cfg, db, redis })
  await ingester.ctx.labelSubscription?.destroy()
  return ingester
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
  const ns = name ? await randomIntFromSeed(name, 1000000) : undefined
  const baseCfg: bsky.IndexerConfigValues = {
    version: '0.0.0',
    serverDid: 'did:example:bsky',
    didCacheStaleTTL: HOUR,
    didCacheMaxTTL: DAY,
    labelerKeywords: { label_me: 'test-label', label_me_2: 'test-label-2' },
    redisHost: process.env.REDIS_HOST || '',
    dbPostgresUrl: process.env.DB_POSTGRES_URL || '',
    dbPostgresSchema: `appview_${name}`,
    didPlcUrl: network.plc.url,
    imgUriEndpoint: '',
    abyssEndpoint: '',
    abyssPassword: '',
    indexerPartitionIds: [0],
    indexerNamespace: `ns${ns}`,
    ingesterPartitionCount: config.ingesterPartitionCount ?? 1,
    moderationPushUrl: config.moderationPushUrl ?? 'https://modservice.invalid',
    ...config,
  }
  const db = new bsky.PrimaryDatabase({
    url: baseCfg.dbPostgresUrl,
    schema: baseCfg.dbPostgresSchema,
  })
  assert(baseCfg.redisHost)
  const redis = new bsky.Redis({
    host: baseCfg.redisHost,
    namespace: baseCfg.indexerNamespace,
  })
  const redisCache = new bsky.Redis({
    host: baseCfg.redisHost,
    namespace: baseCfg.indexerNamespace,
    db: 1,
  })

  const indexers = await Promise.all(
    opts.partitionIdsByIndexer.map(async (indexerPartitionIds) => {
      const cfg = new bsky.IndexerConfig({
        ...baseCfg,
        indexerPartitionIds,
        indexerSubLockId: uniqueLockId(),
        indexerPort: await getPort(),
      })
      return bsky.BskyIndexer.create({ cfg, db, redis, redisCache })
    }),
  )
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
  const sequencer = network.pds.ctx.sequencer
  await network.pds.processAll()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await wait(50)
    // check ingester
    const [ingesterCursor, curr] = await Promise.all([
      ingester.sub.getCursor(),
      sequencer.curr(),
    ])
    const ingesterCaughtUp = curr !== null && ingesterCursor === curr
    if (ingesterCaughtUp) return
  }
}
