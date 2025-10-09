#!/usr/bin/env ts-node

import assert from 'node:assert'
import { once } from 'node:events'
import { Registry, collectDefaultMetrics } from 'prom-client'
import { createMetricsServer } from '../src/api/util'
import {
  BackfillIngester,
  FirehoseIngester,
} from '../src/data-plane/server/ingester'
import { httpLogger } from '../src/logger'
import { Redis } from '../src/redis'

export async function main() {
  const hosts = process.env.INGESTER_HOSTS
  const firehoseStream = process.env.INGESTER_FIREHOSE_STREAM || 'firehose'
  const repoStream = process.env.INGESTER_REPO_STREAM || 'repo_backfill'
  const redisHost = process.env.REDIS_HOST
  const metricsPort = parseInt(process.env.METRICS_PORT || '4000', 10)
  assert(
    hosts,
    'must set INGESTER_HOSTS, e.g. https://morel.us-east.host.bsky.network',
  )
  assert(redisHost, 'must set REDIS_HOST, e.g. redis://localhost:6380')
  const metricsRegistry = new Registry()
  collectDefaultMetrics({ register: metricsRegistry })
  const server = createMetricsServer(metricsRegistry)
  const redis = new Redis({ host: redisHost })
  // firehose ingesters
  const firehoseIngesters = hosts.split(',').map((host) => {
    return new FirehoseIngester({
      redis,
      host,
      stream: firehoseStream,
    })
  })
  // backfill ingesters
  const backfillIngesters = hosts.split(',').map((host) => {
    return new BackfillIngester({
      redis,
      host,
      stream: repoStream,
    })
  })
  FirehoseIngester.metrics.register(metricsRegistry)
  // start
  await once(server.listen(metricsPort), 'listening')
  httpLogger.info({ address: server.address() }, 'server listening')
  firehoseIngesters.forEach((ingester) => ingester.run())
  backfillIngesters.forEach((ingester) => ingester.run())
  // stop
  process.on('SIGINT', async () => {
    httpLogger.info('stopping')
    await Promise.all([
      ...firehoseIngesters.map((ingester) => ingester.stop()),
      ...backfillIngesters.map((ingester) => ingester.stop()),
    ])
    await redis.destroy()
    server.close()
    await once(server, 'close')
  })
}

main()
