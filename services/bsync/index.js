'use strict' /* eslint-disable */

require('dd-trace') // Only works with commonjs
  .init({ logInjection: true })

// Tracer code above must come before anything else
const {
  envToCfg,
  readEnv,
  httpLogger,
  default: BsyncService,
} = require('@atproto/bsync')

const main = async () => {
  const env = readEnv()
  const cfg = envToCfg(env)
  const bsync = await BsyncService.create(cfg)
  await bsync.start()
  httpLogger.info('bsync is running')
  process.on('SIGTERM', async () => {
    httpLogger.info('bsync is stopping')
    await bsync.destroy()
    httpLogger.info('bsync is stopped')
  })
}

main()
