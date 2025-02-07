#!/usr/bin/env ts-node

import assert from 'node:assert'
import { once } from 'node:events'
import { collectDefaultMetrics, Registry } from 'prom-client'
import { Redis } from '../src/redis'
import {
  BackfillIngester,
  FirehoseIngester,
} from '../src/data-plane/server/ingester'
import { createMetricsServer } from '../src/api/util'
import { httpLogger } from '../src/logger'

export async function main() {
  const host = process.env.INGESTER_HOST
  const firehoseStream = process.env.INGESTER_FIREHOSE_STREAM || 'firehose'
  const backfillStream = process.env.INGESTER_BACKFILL_STREAM
  const redisHost = process.env.REDIS_HOST
  const metricsPort = parseInt(process.env.METRICS_PORT || '4000', 10)
  assert(
    host,
    'must set INGESTER_HOST, e.g. https://morel.us-east.host.bsky.network',
  )
  assert(redisHost, 'must set REDIS_HOST, e.g. redis://localhost:6380')
  const metricsRegistry = new Registry()
  collectDefaultMetrics({ register: metricsRegistry })
  const server = createMetricsServer(metricsRegistry)
  const redis = new Redis({ host: redisHost })
  // firehose ingester
  const firehose = new FirehoseIngester({
    redis,
    host,
    stream: firehoseStream,
  })
  FirehoseIngester.metrics.register(metricsRegistry)
  // backfill ingester
  let backfill: BackfillIngester | undefined
  if (backfillStream) {
    backfill = new BackfillIngester({
      redis,
      host,
      stream: backfillStream,
    })
  }
  // start
  await once(server.listen(metricsPort), 'listening')
  httpLogger.info({ address: server.address() }, 'server listening')
  firehose.run()
  backfill?.run()
  // stop
  process.on('SIGINT', async () => {
    httpLogger.info('stopping')
    await firehose.stop()
    await backfill?.stop()
    await redis.destroy()
    server.close()
    await once(server, 'close')
  })
}

main()
