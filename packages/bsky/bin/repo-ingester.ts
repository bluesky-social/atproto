#!/usr/bin/env ts-node

import assert from 'node:assert'
import { once } from 'node:events'
import { collectDefaultMetrics, Registry } from 'prom-client'
import { Redis } from '../src/redis'
import { RepoIngester } from '../src/data-plane/server/ingester/repo'
import { createMetricsServer } from '../src/api/util'
import { httpLogger } from '../src/logger'

export async function main() {
  const group = process.env.INGESTER_GROUP || 'backfill_group'
  const consumer = process.env.INGESTER_CONSUMER
  const concurrency = process.env.INGESTER_CONCURRENCY
    ? parseInt(process.env.INGESTER_CONCURRENCY, 10)
    : undefined
  const firehoseStream = process.env.INGESTER_FIREHOSE_STREAM || 'firehose'
  const backfillStream = process.env.INGESTER_BACKFILL_STREAM || 'backfill'
  const redisHost = process.env.REDIS_HOST
  const metricsPort = parseInt(process.env.METRICS_PORT || '4010', 10)
  assert(redisHost, 'must set REDIS_HOST, e.g. redis://localhost:6380')
  assert(consumer, 'must set INGESTER_CONSUMER, e.g. one')
  const metricsRegistry = new Registry()
  collectDefaultMetrics({ register: metricsRegistry })
  const server = createMetricsServer(metricsRegistry)
  const redis = new Redis({ host: redisHost })
  // repo ingester
  const ingester = new RepoIngester({
    redis,
    streamIn: backfillStream,
    streamOut: firehoseStream,
    group,
    consumer,
    concurrency,
  })
  // start
  await once(server.listen(metricsPort), 'listening')
  httpLogger.info({ address: server.address() }, 'server listening')
  ingester.run()
  // stop
  process.on('SIGINT', async () => {
    httpLogger.info('stopping')
    await ingester.stop()
    await redis.destroy()
    server.close()
    await once(server, 'close')
  })
}

main()
