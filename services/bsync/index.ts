/* eslint-disable import/order */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
require('dd-trace').init({ logInjection: true })

// Tracer code above must come before anything else
import BsyncService, { envToCfg, httpLogger, readEnv } from '@atproto/bsync'

const main = async () => {
  const env = readEnv()
  const cfg = envToCfg(env)
  const bsync = await BsyncService.create(cfg)
  if (bsync.ctx.cfg.db.migrate) {
    httpLogger.info('bsync db is migrating')
    await bsync.ctx.db.migrateToLatestOrThrow()
    httpLogger.info('bsync db migration complete')
  }
  await bsync.start()
  httpLogger.info('bsync is running')
  process.on('SIGTERM', async () => {
    httpLogger.info('bsync is stopping')
    await bsync.destroy()
    httpLogger.info('bsync is stopped')
  })
}

main()
