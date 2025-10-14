'use strict' /* eslint-env node */

const assert = require('node:assert')
const { once } = require('node:events')
const { Registry, collectDefaultMetrics } = require('prom-client')
const {
  Redis,
  RepoBackfiller,
  createMetricsServer,
  httpLogger,
} = require('@atproto/bsky')

async function main() {
  const group = process.env.BACKFILLER_GROUP || 'repo_backfill_group'
  const consumer = process.env.BACKFILLER_CONSUMER
  const concurrency = process.env.BACKFILLER_CONCURRENCY
    ? parseInt(process.env.BACKFILLER_CONCURRENCY, 10)
    : undefined
  const repoStream = process.env.BACKFILLER_BACKFILL_STREAM || 'repo_backfill'
  const firehoseStream =
    process.env.BACKFILLER_FIREHOSE_STREAM || 'firehose_backfill'
  const firehoseStreamHighWaterMark = parseInt(
    process.env.BACKFILLER_FIREHOSE_STREAM_HIGH_WATER_MARK || '100000',
    10,
  )
  const redisHost = process.env.REDIS_HOST
  const metricsPort = parseInt(process.env.METRICS_PORT || '4010', 10)
  assert(redisHost, 'must set REDIS_HOST, e.g. localhost:6380')
  assert(consumer, 'must set BACKFILLER_CONSUMER, e.g. one')
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
    highWaterMark: firehoseStreamHighWaterMark,
  })
  // start
  await once(server.listen(metricsPort), 'listening')
  httpLogger.info({ address: server.address() }, 'server listening')
  ingester.run()
  // stop
  process.on('SIGTERM', async () => {
    httpLogger.info('stopping')
    await ingester.stop()
    await redis.destroy()
    server.close()
    await once(server, 'close')
  })
}

main()
