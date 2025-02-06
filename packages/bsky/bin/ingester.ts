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
  const firehose = new FirehoseIngester({
    redis,
    host,
    stream: 'firehose',
    // highWaterMark: 100,
  })
  metricsRegistry.registerMetric(firehose.eventCounter)
  const backfill = new BackfillIngester({
    redis,
    host,
    stream: 'backfill',
    // highWaterMark: 10000,
  })
  await once(server.listen(3000), 'listening')
  httpLogger.info({ address: server.address() }, 'server listening')
  firehose.run()
  backfill.run()
  await wait(60000)
  await firehose.stop()
  await backfill.stop()
  await redis.destroy()
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
