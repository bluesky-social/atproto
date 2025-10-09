/* eslint-env node */

const assert = require('node:assert')
const { once } = require('node:events')
const { Registry, collectDefaultMetrics } = require('prom-client')
const {
  BackgroundQueue,
  Database,
  IndexingService,
  Redis,
  StreamIndexer,
  createMetricsServer,
  httpLogger,
} = require('@atproto/bsky')
const { IdResolver } = require('@atproto/identity')

async function main() {
  const streams =
    process.env.INDEXER_STREAMS || 'firehose_live,firehose_backfill'
  const group = process.env.INDEXER_GROUP || 'firehose_group'
  const consumer = process.env.INDEXER_CONSUMER
  const concurrency = parseInt(process.env.INDEXER_CONCURRENCY || '10', 10)
  const redisHost = process.env.REDIS_HOST
  const postgresUrl = process.env.DB_POSTGRES_URL
  const metricsPort = parseInt(process.env.METRICS_PORT || '4020', 10)
  assert(consumer, 'must set INDEXER_CONSUMER, e.g. one')
  assert(redisHost, 'must set REDIS_HOST, e.g. redis://localhost:6380')
  assert(
    postgresUrl,
    'must set DB_POSTGRES_URL, e.g. postgres://user:pass@localhost:5432/postgres',
  )
  const metricsRegistry = new Registry()
  collectDefaultMetrics({ register: metricsRegistry })
  const server = createMetricsServer(metricsRegistry)
  const db = new Database({ url: postgresUrl })
  await db.migrateToLatestOrThrow()
  // redis stream indexers
  // need separate redises for separate blocking stream reads
  const redises = streams.split(',').map(() => new Redis({ host: redisHost }))
  const indexers = streams.split(',').map((stream, i) => {
    return new StreamIndexer({
      stream,
      group,
      consumer,
      redis: redises[i],
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
    await Promise.all(redises.map((redis) => redis.destroy()))
    await db.close()
    server.close()
    await once(server, 'close')
  })
}

main()
