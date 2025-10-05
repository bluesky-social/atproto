// Based on: https://github.com/zeppelin-social/atproto/blob/main/services/bsky/api.js
import assert from 'node:assert'
import cluster from 'node:cluster'
import {
  BskyAppView,
  DataPlaneServer,
  Database,
  MockBsync,
  RepoSubscription,
  ServerConfig,
} from '@atproto/bsky'
import { Secp256k1Keypair } from '@atproto/crypto'

const main = async () => {
  const env = getEnv()
  const config = ServerConfig.readEnv()
  assert(env.serviceSigningKey, 'must set BSKY_SERVICE_SIGNING_KEY')
  const signingKey = await Secp256k1Keypair.import(env.serviceSigningKey)

  // forked from upstream:
  assert(env.dbPostgresUrl, 'must set BSKY_DB_POSTGRES_URL')

  const migrationDb = new Database({
    url: env.dbPostgresUrl,
    schema: env.dbPostgresSchema,
  })
  await migrationDb.migrateToLatestOrThrow()
  await migrationDb.close()

  const db = new Database({
    url: env.dbPostgresUrl,
    schema: env.dbPostgresSchema,
    poolSize: env.dbPoolSize,
  })

  // involve logics in packages/dev-env/src/bsky.ts
  assert(env.bsyncPort, 'must set BSKY_BSYNC_PORT')
  assert(env.dataplanePort, 'must set BSKY_DATAPLANE_PORT')

  const bsync = await MockBsync.create(db, env.bsyncPort)

  const dataplane = await DataPlaneServer.create(
    db,
    env.dataplanePort,
    config.didPlcUrl,
  )

  const server = BskyAppView.create({ config, signingKey })

  assert(env.repoProvider, 'must set BSKY_REPO_PROVIDER')

  const sub = new RepoSubscription({
    service: env.repoProvider,
    db,
    idResolver: dataplane.idResolver,
  })

  await server.start()

  // RepoSubscription builds its MemoryRunner with concurrency: Infinity,
  // so a startCursor:0 backfill buffers the PDS's whole history into the
  // heap and OOMs. We can't pass a runner in (no constructor seam), but
  // both `runner` and `mainQueue` are public, and p-queue's concurrency
  // is a live setter — cap it before starting. Tune as needed.
  sub.runner.mainQueue.concurrency = 25

  sub.start()
  // Graceful shutdown (see also https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/)
  const shutdown = async () => {
    await sub.destroy()
    await server.destroy()
    await dataplane.destroy()
    await bsync.destroy()
    await db.close()
  }

  // end fork

  process.on('SIGTERM', shutdown)
  process.on('disconnect', shutdown) // when clustering
}

const getEnv = () => ({
  serviceSigningKey: process.env.BSKY_SERVICE_SIGNING_KEY || undefined,
  // forked:
  dbPostgresUrl: process.env.BSKY_DB_POSTGRES_URL || undefined,
  dbPostgresSchema: process.env.BSKY_DB_POSTGRES_SCHEMA || undefined,
  dbPoolSize: maybeParseInt(process.env.BSKY_DB_POOL_SIZE) || undefined,
  dataplanePort: maybeParseInt(process.env.BSKY_DATAPLANE_PORT) || undefined,
  bsyncPort: maybeParseInt(process.env.BSKY_BSYNC_PORT) || undefined,
  migration: process.env.ENABLE_MIGRATIONS === 'true' || undefined,
  repoProvider: process.env.BSKY_REPO_PROVIDER || undefined,
})

const maybeParseInt = (str: string | undefined) => {
  if (!str) return
  const int = parseInt(str, 10)
  if (isNaN(int)) return
  return int
}

const workerCount = maybeParseInt(process.env.CLUSTER_WORKER_COUNT)

if (workerCount) {
  if (cluster.isPrimary) {
    console.log(`primary ${process.pid} is running`)
    const workers = new Set<ReturnType<typeof cluster.fork>>()
    for (let i = 0; i < workerCount; ++i) {
      workers.add(cluster.fork())
    }
    let teardown = false
    cluster.on('exit', (worker) => {
      workers.delete(worker)
      if (!teardown) {
        workers.add(cluster.fork()) // restart on crash
      }
    })
    process.on('SIGTERM', () => {
      teardown = true
      console.log('disconnecting workers')
      workers.forEach((w) => w.disconnect())
    })
  } else {
    console.log(`worker ${process.pid} is running`)
    main()
  }
} else {
  main() // non-clustering
}
