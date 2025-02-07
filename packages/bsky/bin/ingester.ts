#!/usr/bin/env ts-node

import assert from 'node:assert'
import { once } from 'node:events'
import http from 'node:http'
import { wait } from '@atproto/common'
import { collectDefaultMetrics, Registry } from 'prom-client'
import { Redis } from '../src/redis'
import {
  BackfillIngester,
  FirehoseIngester,
} from '../src/data-plane/server/ingester'
import { StreamIndexer } from '../src/data-plane/server/indexer'
import { httpLogger } from '../src/logger'

export async function main() {
  const host = process.env.INGESTER_HOST
  const redisHost = process.env.REDIS_HOST
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
    stream: 'firehose',
  })
  FirehoseIngester.metrics.register(metricsRegistry)
  // backfill ingester
  const backfill = new BackfillIngester({
    redis,
    host,
    stream: 'backfill',
  })
  // redis stream indexers
  const indexer1 = new StreamIndexer({
    stream: 'firehose',
    group: 'firehose_group',
    consumer: 'one',
    redis,
    concurrency: 10,
  })
  const indexer2 = new StreamIndexer({
    stream: 'firehose',
    group: 'firehose_group',
    consumer: 'two',
    redis,
    concurrency: 50,
  })
  StreamIndexer.metrics.register(metricsRegistry)
  // start
  await once(server.listen(3000), 'listening')
  httpLogger.info({ address: server.address() }, 'server listening')
  firehose.run()
  indexer1.run()
  indexer2.run()
  backfill.run()
  await wait(120000)
  // stop
  httpLogger.info('stopping')
  await firehose.stop()
  await indexer1.stop()
  await indexer2.stop()
  await backfill.stop()
  await redis.destroy()
  server.close()
  await once(server, 'close')
}

main()

function createMetricsServer(registry: Registry) {
  return http.createServer(async (req, res) => {
    try {
      if (req.url === '/metrics') {
        res.statusCode = 200
        res.setHeader('content-type', registry.contentType)
        return res.end(await registry.metrics())
      }
      res.statusCode = 404
      res.setHeader('content-type', 'text/plain')
      return res.end('not found')
    } catch (err) {
      httpLogger.error({ err }, 'internal server error')
      res.statusCode = 500
      res.setHeader('content-type', 'text/plain')
      return res.end('internal server error')
    }
  })
}
