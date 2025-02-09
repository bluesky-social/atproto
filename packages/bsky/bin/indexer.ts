#!/usr/bin/env ts-node

import assert from 'node:assert'
import { once } from 'node:events'
import { collectDefaultMetrics, Registry } from 'prom-client'
import { IdResolver } from '@atproto/identity'
import { Redis } from '../src/redis'
import { StreamIndexer } from '../src/data-plane/server/indexer'
import { createMetricsServer } from '../src/api/util'
import { httpLogger } from '../src/logger'
import { Database } from '../src/data-plane/server/db'
import { IndexingService } from '../src/data-plane/server/indexing'
import { BackgroundQueue } from '../src/data-plane/server/background'

export async function main() {
  const streams = process.env.INDEXER_STREAMS || 'firehose,firehose_backfill'
  // const group = process.env.INDEXER_GROUP || 'firehose_group'
  const consumer = process.env.INDEXER_CONSUMER
  const concurrency = parseInt(process.env.INDEXER_CONCURRENCY || '10', 10)
  const redisHost = process.env.REDIS_HOST
  const postgresUrl = process.env.DB_POSTGRES_URL
  const metricsPort = parseInt(process.env.METRICS_PORT || '4001', 10)
  assert(consumer, 'must set INDEXER_CONSUMER, e.g. one')
  assert(redisHost, 'must set REDIS_HOST, e.g. redis://localhost:6380')
  assert(
    postgresUrl,
    'must set DB_POSTGRES_URL, e.g. postgres://user:pass@localhost:5432/postgres',
  )
  const metricsRegistry = new Registry()
  collectDefaultMetrics({ register: metricsRegistry })
  const server = createMetricsServer(metricsRegistry)
  const redis = new Redis({ host: redisHost })
  const db = new Database({ url: postgresUrl })
  await db.migrateToLatestOrThrow()
  // redis stream indexers
  const indexers = streams.split(',').map((stream) => {
    return new StreamIndexer({
      stream,
      group: `${stream}_group`,
      consumer,
      redis,
      concurrency,
      indexingService: new IndexingService(
        db,
        new IdResolver(), // @TODO redis-cached
        new BackgroundQueue(db),
      ),
    })
  })

  StreamIndexer.metrics.register(metricsRegistry)
  // start
  await once(server.listen(metricsPort), 'listening')
  httpLogger.info({ address: server.address() }, 'server listening')
  indexers.map((indexer) => indexer.run())
  // stop
  process.on('SIGINT', async () => {
    httpLogger.info('stopping')
    await Promise.all(indexers.map((indexer) => indexer.stop()))
    await redis.destroy()
    await db.close()
    server.close()
    await once(server, 'close')
  })
}

main()
