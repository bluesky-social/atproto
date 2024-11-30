/* eslint-env node */

'use strict'

const {
  PDS,
  envToCfg,
  envToSecrets,
  readEnv,
  httpLogger,
} = require('@atproto/pds')
const pkg = require('@atproto/pds/package.json')

const main = async () => {
  const env = readEnv()
  env.version ??= pkg.version
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const pds = await PDS.create(cfg, secrets)

  await pds.start()

  httpLogger.info('pds is running')
  // Graceful shutdown (see also https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/)
  process.on('SIGTERM', async () => {
    httpLogger.info('pds is stopping')
    await pds.destroy()
    httpLogger.info('pds is stopped')
  })
}

main()
