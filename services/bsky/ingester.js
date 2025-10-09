/* eslint-env node */

const assert = require('node:assert')
const { once } = require('node:events')
const { Registry, collectDefaultMetrics } = require('prom-client')
const {
  BackfillIngester,
  FirehoseIngester,
  LabelerIngester,
  Redis,
  createMetricsServer,
  httpLogger,
} = require('@atproto/bsky')

async function main() {
  const hosts = process.env.INGESTER_HOSTS
  const labelerHosts = process.env.INGESTER_LABELER_HOSTS
  const firehoseStream = process.env.INGESTER_FIREHOSE_STREAM || 'firehose_live'
  const labelStream = process.env.INGESTER_LABEL_STREAM || 'label_live'
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
  const labelerIngesters = labelerHosts.split(',').map((host) => {
    return new LabelerIngester({
      redis,
      host,
      stream: labelStream,
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
  LabelerIngester.metrics.register(metricsRegistry)
  // @TODO not implemented BackfillIngester.metrics.register(metricsRegistry)
  // start
  await once(server.listen(metricsPort), 'listening')
  httpLogger.info({ address: server.address() }, 'server listening')
  firehoseIngesters.forEach((ingester) => ingester.run())
  labelerIngesters.forEach((ingester) => ingester.run())
  backfillIngesters.forEach((ingester) => ingester.run())
  // stop
  process.on('SIGINT', async () => {
    httpLogger.info('stopping')
    await Promise.all([
      ...firehoseIngesters.map((ingester) => ingester.stop()),
      ...labelerIngesters.map((ingester) => ingester.stop()),
      ...backfillIngesters.map((ingester) => ingester.stop()),
    ])
    await redis.destroy()
    server.close()
    await once(server, 'close')
  })
}

main()
