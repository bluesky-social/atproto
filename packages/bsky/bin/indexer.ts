#!/usr/bin/env ts-node

import assert from 'node:assert'
import { once } from 'node:events'
import { collectDefaultMetrics, Registry } from 'prom-client'
import { Redis } from '../src/redis'
import { StreamIndexer } from '../src/data-plane/server/indexer'
import { createMetricsServer } from '../src/api/util'
import { httpLogger } from '../src/logger'

export async function main() {
  const stream = process.env.INDEXER_STREAM || 'firehose'
  const group = process.env.INDEXER_GROUP || 'firehose_group'
  const consumer = process.env.INDEXER_CONSUMER
  const concurrency = parseInt(process.env.INDEXER_CONCURRENCY || '10', 10)
  const redisHost = process.env.REDIS_HOST
  const metricsPort = parseInt(process.env.METRICS_PORT || '3000', 10)
  assert(consumer, 'must set INDEXER_CONSUMER, e.g. one')
  assert(redisHost, 'must set REDIS_HOST, e.g. redis://localhost:6380')
  const metricsRegistry = new Registry()
  collectDefaultMetrics({ register: metricsRegistry })
  const server = createMetricsServer(metricsRegistry)
  const redis = new Redis({ host: redisHost })
  // redis stream indexers
  const indexer = new StreamIndexer({
    stream,
    group,
    consumer,
    redis,
    concurrency,
  })
  StreamIndexer.metrics.register(metricsRegistry)
  // start
  await once(server.listen(metricsPort), 'listening')
  httpLogger.info({ address: server.address() }, 'server listening')
  indexer.run()
  // stop
  process.on('SIGINT', async () => {
    httpLogger.info('stopping')
    await indexer.stop()
    await redis.destroy()
    server.close()
    await once(server, 'close')
  })
}

main()
