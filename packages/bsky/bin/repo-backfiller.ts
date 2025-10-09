#!/usr/bin/env ts-node

import assert from 'node:assert'
import { once } from 'node:events'
import { Registry, collectDefaultMetrics } from 'prom-client'
import { createMetricsServer } from '../src/api/util'
import { RepoBackfiller } from '../src/data-plane/server/ingester/repo-backfiller'
import { httpLogger } from '../src/logger'
import { Redis } from '../src/redis'

export async function main() {
  const group = process.env.BACKFILLER_GROUP || 'repo_backfill_group'
  const consumer = process.env.BACKFILLER_CONSUMER
  const concurrency = process.env.BACKFILLER_CONCURRENCY
    ? parseInt(process.env.BACKFILLER_CONCURRENCY, 10)
    : undefined
  const repoStream = process.env.BACKFILLER_BACKFILL_STREAM || 'repo_backfill'
  const firehoseStream =
    process.env.BACKFILLER_FIREHOSE_STREAM || 'firehose_backfill'
  const redisHost = process.env.REDIS_HOST
  const metricsPort = parseInt(process.env.METRICS_PORT || '4010', 10)
  assert(redisHost, 'must set REDIS_HOST, e.g. redis://localhost:6380')
  assert(consumer, 'must set INGESTER_CONSUMER, e.g. one')
  const metricsRegistry = new Registry()
  collectDefaultMetrics({ register: metricsRegistry })
  const server = createMetricsServer(metricsRegistry)
  const redis = new Redis({ host: redisHost })
  // repo ingester
  const ingester = new RepoBackfiller({
    redis,
    streamIn: repoStream,
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
