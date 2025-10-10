'use strict' /* eslint-env node */

const assert = require('node:assert')
const {
  DataPlaneServer,
  Database,
  RedisDidCache,
  httpLogger,
} = require('@atproto/bsky')
const { Redis } = require('@atproto/bsky')

async function main() {
  const port = parseInt(process.env.DATAPLANE_PORT || '3300', 10)
  const redisHost = process.env.REDIS_HOST
  const postgresUrl = process.env.DB_POSTGRES_URL
  assert(redisHost, 'must set REDIS_HOST, e.g. localhost:6380')
  const db = new Database({ url: postgresUrl })
  await db.migrateToLatestOrThrow()
  const didCacheRedis = new Redis({ host: redisHost, namespace: 'identity' })
  const dataplane = await DataPlaneServer.create(
    db,
    port,
    undefined,
    new RedisDidCache(didCacheRedis),
  )
  httpLogger.info({ address: dataplane.server.address() }, 'server listening')
  // stop
  process.on('SIGTERM', async () => {
    httpLogger.info('stopping')
    await dataplane.destroy()
    await didCacheRedis.destroy()
  })
}

main()
